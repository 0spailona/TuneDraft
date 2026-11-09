#!/usr/bin/env bash
#
# scripts/dev-android.sh — дев-окружение TuneDraft одной командой:
#   эмулятор (AVD) + Metro (expo start) + открытое приложение TuneDraft.
#
# Использование:
#   scripts/dev-android.sh [AVD_NAME]     # AVD_NAME по умолчанию: TuneDraft_Tablet
#
# Поведение (идемпотентно, безопасно перезапускать):
#   - если AVD с таким именем уже запущен — переиспользуется, второй не создаётся;
#   - если Metro уже отвечает на :8081 — второй экземпляр не запускается;
#   - выполняется adb reverse tcp:8081 tcp:8081 (Metro доступен приложению);
#   - Ctrl+C останавливает Metro; эмулятор продолжает работать.
#
# Переменные окружения (необязательно):
#   TUNEDRAFT_BOOT_TIMEOUT  — сек. на полную загрузку эмулятора: общий дедлайн
#                             стадий «устройство появилось» и «sys.boot_completed»
#                             (по умолчанию 180)
#   TUNEDRAFT_METRO_TIMEOUT — сек. ожидания старта Metro (по умолчанию 60)

set -euo pipefail

AVD_NAME="${1:-TuneDraft_Tablet}"
APP_PACKAGE="com.tunedraft.app"
METRO_PORT="8081"
METRO_STATUS_URL="http://localhost:${METRO_PORT}/status"
METRO_OK="packager-status:running"
BOOT_TIMEOUT="${TUNEDRAFT_BOOT_TIMEOUT:-180}"
METRO_TIMEOUT="${TUNEDRAFT_METRO_TIMEOUT:-60}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
EMU_LOG="/tmp/tunedraft-emulator-${AVD_NAME}.log"

log()  { printf '\033[1;34m[dev-android]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[dev-android]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[dev-android] ОШИБКА:\033[0m %s\n' "$*" >&2; exit 1; }

# ── 1. adb / emulator: $ANDROID_HOME, фолбэк на PATH ─────────────────────────
if [[ -n "${ANDROID_HOME:-}" && -x "${ANDROID_HOME}/platform-tools/adb" ]]; then
  ADB="${ANDROID_HOME}/platform-tools/adb"
elif command -v adb >/dev/null 2>&1; then
  ADB="$(command -v adb)"
else
  die "adb не найден. Установите Android SDK (platform-tools) и/или задайте ANDROID_HOME."
fi

if [[ -n "${ANDROID_HOME:-}" && -x "${ANDROID_HOME}/emulator/emulator" ]]; then
  EMULATOR="${ANDROID_HOME}/emulator/emulator"
elif command -v emulator >/dev/null 2>&1; then
  EMULATOR="$(command -v emulator)"
else
  die "emulator не найден. Установите Android Emulator и/или задайте ANDROID_HOME."
fi

if ! command -v curl >/dev/null 2>&1; then
  die "curl не найден (нужен для проверки статуса Metro на :${METRO_PORT})."
fi

# ── 2. Проверка существования AVD ─────────────────────────────────────────────
AVD_LIST="$("$EMULATOR" -list-avds 2>/dev/null || true)"
if ! grep -qxF -- "$AVD_NAME" <<<"$AVD_LIST"; then
  warn "AVD '${AVD_NAME}' не найден. Доступные AVD:"
  if [[ -n "$AVD_LIST" ]]; then
    sed 's/^/  - /' <<<"$AVD_LIST" >&2
  else
    warn "  (список пуст — создайте AVD: Android Studio → Device Manager → Create Device)"
  fi
  exit 1
fi

# ── Вспомогательные функции ──────────────────────────────────────────────────
# Общий дедлайн загрузки (14а ревью ST-5): TUNEDRAFT_BOOT_TIMEOUT делится
# между «устройство появилось» (шаг 4) и «sys.boot_completed» (шаг 5) —
# раньше каждая стадия получала полный таймаут, и скрипт мог ждать до 2×.
BOOT_DEADLINE=$((SECONDS + BOOT_TIMEOUT))

# Серийный номер запущенного устройства (state=device) с данным AVD, иначе пусто.
find_serial_for_avd() {
  local serial state name
  while read -r serial state; do
    [[ "$state" == "device" ]] || continue
    name="$("$ADB" -s "$serial" emu avd name 2>/dev/null | head -n 1 | tr -d '\r' || true)"
    if [[ "$name" == "$AVD_NAME" ]]; then
      printf '%s\n' "$serial"
      return 0
    fi
  done < <("$ADB" devices 2>/dev/null | awk 'NR>1 && NF>=2 {print $1, $2}')
  return 0
}

metro_running() {
  local status
  # --noproxy '*' (14а ревью ST-5): localhost-проверка не должна уходить в
  # экспортированный http_proxy — иначе скрипт ложно решит, что Metro молчит.
  status="$(curl -fsS --noproxy '*' --max-time 2 "$METRO_STATUS_URL" 2>/dev/null || true)"
  [[ "$status" == *"$METRO_OK"* ]]
}

open_app() {
  local packages
  packages="$("$ADB" -s "$TARGET_SERIAL" shell pm list packages 2>/dev/null | tr -d '\r' || true)"
  if grep -qxF -- "package:${APP_PACKAGE}" <<<"$packages"; then
    log "Открываю приложение ${APP_PACKAGE} на ${TARGET_SERIAL}..."
    "$ADB" -s "$TARGET_SERIAL" shell monkey -p "$APP_PACKAGE" \
      -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 ||
      warn "monkey не смог запустить ${APP_PACKAGE} — попробуйте открыть приложение вручную."
  else
    warn "Пакет ${APP_PACKAGE} не установлен на ${TARGET_SERIAL}."
    warn "Выполните один раз: npm run android — соберёт и установит dev-сборку TuneDraft,"
    warn "затем повторно запустите scripts/dev-android.sh."
  fi
}

METRO_PID=""
cleanup() {
  if [[ -n "$METRO_PID" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null || true
    wait "$METRO_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

# ── 3. Целевой AVD уже запущен? ───────────────────────────────────────────────
TARGET_SERIAL="$(find_serial_for_avd)"

if [[ -n "$TARGET_SERIAL" ]]; then
  log "Эмулятор '${AVD_NAME}' уже запущен (${TARGET_SERIAL}) — переиспользую его."
else
  # ── 4. Запуск эмулятора отсоединённо ────────────────────────────────────────
  log "Запускаю эмулятор '${AVD_NAME}' (лог: ${EMU_LOG})..."
  nohup "$EMULATOR" -avd "$AVD_NAME" >"$EMU_LOG" 2>&1 &
  disown 2>/dev/null || true

  # Ждём, пока устройство появится в adb devices со state=device.
  while (( SECONDS < BOOT_DEADLINE )); do
    TARGET_SERIAL="$(find_serial_for_avd)"
    [[ -n "$TARGET_SERIAL" ]] && break
    sleep 2
  done
  [[ -n "$TARGET_SERIAL" ]] ||
    die "Эмулятор '${AVD_NAME}' не появился в 'adb devices' за отведённые ${BOOT_TIMEOUT} c (общий дедлайн со стадией загрузки).
  Смотрите лог эмулятора: ${EMU_LOG}"
fi

# ── 5. Ожидание полной загрузки эмулятора ─────────────────────────────────────
log "Жду загрузки ${TARGET_SERIAL} (sys.boot_completed, общий дедлайн ${BOOT_TIMEOUT} c)..."
boot=""
while (( SECONDS < BOOT_DEADLINE )); do
  boot="$("$ADB" -s "$TARGET_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  [[ "$boot" == "1" ]] && break
  sleep 2
done
if [[ "$boot" != "1" ]]; then
  die "Эмулятор не завершил загрузку за отведённые ${BOOT_TIMEOUT} c (общий дедлайн с появлением устройства).
  Подсказки: перезапустите его ('${ADB} -s ${TARGET_SERIAL} emu kill', затем снова этот скрипт),
  проверьте лог ${EMU_LOG}; при зависании AVD поможет холодный старт/wipe:
  '${EMULATOR} -avd ${AVD_NAME} -no-snapshot-save' или '-wipe-data'."
fi
log "Эмулятор загружен: ${TARGET_SERIAL} (${AVD_NAME})"

# ── 6. Проброс порта Metro в эмулятор ────────────────────────────────────────
if "$ADB" -s "$TARGET_SERIAL" reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"; then
  log "adb reverse tcp:${METRO_PORT} tcp:${METRO_PORT} → ${TARGET_SERIAL}"
else
  die "Не удалось выполнить 'adb reverse tcp:${METRO_PORT} tcp:${METRO_PORT}'."
fi

# ── 7. Metro уже работает на :8081? Не запускаем второй ───────────────────────
if metro_running; then
  log "Metro уже работает на :${METRO_PORT} — второй экземпляр не запускаю."
  open_app
  log "Готово: Metro на :${METRO_PORT}, приложение открыто."
  exit 0
fi

# ── 8. Запуск Metro на переднем плане ────────────────────────────────────────
cd "$REPO_ROOT"
log "Запускаю Metro: npx expo start  (cwd: ${REPO_ROOT})"
npx expo start &
METRO_PID=$!

# ── 9. Ждём Metro, затем открываем приложение ────────────────────────────────
log "Жду Metro на :${METRO_PORT} (таймаут ${METRO_TIMEOUT} c)..."
local_deadline=$((SECONDS + METRO_TIMEOUT))
metro_up="no"
while (( SECONDS < local_deadline )); do
  if metro_running; then
    metro_up="yes"
    break
  fi
  kill -0 "$METRO_PID" 2>/dev/null || break
  sleep 1
done

if [[ "$metro_up" != "yes" ]]; then
  die "Metro не поднялся на :${METRO_PORT} за ${METRO_TIMEOUT} c
  (возможно, 'npx expo start' завершился с ошибкой — смотрите вывод выше).
  Если порт занят другим процессом: 'lsof -i :${METRO_PORT}'."
fi
log "Metro работает: ${METRO_STATUS_URL}"

open_app

# ── 10. Ctrl+C останавливает Metro; эмулятор продолжает работать ──────────────
log "Metro работает в переднем плане. Ctrl+C — остановить Metro (эмулятор останется запущенным)."
wait "$METRO_PID"
