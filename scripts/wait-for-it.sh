#!/bin/bash
# Use this script to test if a given TCP host/port is available

WAITFORIT_cmdname=${0##*/}

echoerr() { if [[ $WAITFORIT_QUIET -ne 1 ]]; then echo "$@" 1>&2; fi }

usage()
{
    cat << USAGE >&2
Usage:
    $WAITFORIT_cmdname host:port [-s] [-t timeout] [-- command args]
    -h HOST | --host=HOST       HOST or IP under test
    -p PORT | --port=PORT       TCP port under test
                                Alternatively, you specify the host and port as host:port
    -s | --strict               Only execute subcommand if the test succeeds
    -q | --quiet                Don't output any status messages
    -t TIMEOUT | --timeout=TIMEOUT
                                Timeout in seconds, zero for no timeout
    -- COMMAND ARGS             Execute command with args after the test finishes
USAGE
    exit 1
}

wait_for()
{
    if [[ $WAITFORIT_TIMEOUT -gt 0 ]]; then
        echoerr "$WAITFORIT_cmdname: waiting $WAITFORIT_TIMEOUT seconds for $WAITFORIT_HOST:$WAITFORIT_PORT"
    else
        echoerr "$WAITFORIT_cmdname: waiting for $WAITFORIT_HOST:$WAITFORIT_PORT without timeout"
    fi
    start_ts=$(date +%s)
    while :
    do
        if [[ $WAITFORIT_ISBUSY -eq 1 ]]; then
            nc -z "$WAITFORIT_HOST" "$WAITFORIT_PORT"
            result=$?
        else
            (echo -n > /dev/tcp/"$WAITFORIT_HOST"/"$WAITFORIT_PORT") >/dev/null 2>&1
            result=$?
        fi
        if [[ $result -eq 0 ]]; then
            end_ts=$(date +%s)
            echoerr "$WAITFORIT_cmdname: $WAITFORIT_HOST:$WAITFORIT_PORT is available after $((end_ts - start_ts)) seconds"
            break
        fi
        sleep 1
    done
    return $result
}

wait_for_wrapper()
{
    if [[ $WAITFORIT_TIMEOUT -gt 0 ]]; then
        timeout "$WAITFORIT_TIMEOUT" "$0" --child --host="$WAITFORIT_HOST" --port="$WAITFORIT_PORT" --timeout="$WAITFORIT_TIMEOUT"
    else
        "$0" --child --host="$WAITFORIT_HOST" --port="$WAITFORIT_PORT" --timeout="$WAITFORIT_TIMEOUT"
    fi
    return $?
}

# Process arguments
while [[ $# -gt 0 ]]
do
    case "$1" in
        *:* )
        hostport=(${1//:/ })
        WAITFORIT_HOST=${hostport[0]}
        WAITFORIT_PORT=${hostport[1]}
        shift 1
        ;;
        --child)
        WAITFORIT_CHILD=1
        shift 1
        ;;
        -q | --quiet)
        WAITFORIT_QUIET=1
        shift 1
        ;;
        -s | --strict)
        WAITFORIT_STRICT=1
        shift 1
        ;;
        -h)
        WAITFORIT_HOST="$2"
        shift 2
        ;;
        --host=*)
        WAITFORIT_HOST="${1#*=}"
        shift 1
        ;;
        -p)
        WAITFORIT_PORT="$2"
        shift 2
        ;;
        --port=*)
        WAITFORIT_PORT="${1#*=}"
        shift 1
        ;;
        -t)
        WAITFORIT_TIMEOUT="$2"
        shift 2
        ;;
        --timeout=*)
        WAITFORIT_TIMEOUT="${1#*=}"
        shift 1
        ;;
        --)
        shift
        WAITFORIT_CLI=("$@")
        break
        ;;
        *)
        echoerr "Unknown argument: $1"
        usage
        ;;
    esac
done

if [[ -z "$WAITFORIT_HOST" || -z "$WAITFORIT_PORT" ]]; then
    echoerr "Error: you need to provide a host and port to test."
    usage
fi

WAITFORIT_TIMEOUT=${WAITFORIT_TIMEOUT:-15}
WAITFORIT_STRICT=${WAITFORIT_STRICT:-0}
WAITFORIT_CHILD=${WAITFORIT_CHILD:-0}
WAITFORIT_QUIET=${WAITFORIT_QUIET:-0}

# Check nc or bash /dev/tcp
if type nc >/dev/null 2>&1; then
    WAITFORIT_ISBUSY=1
else
    WAITFORIT_ISBUSY=0
fi

if [[ $WAITFORIT_CHILD -eq 1 ]]; then
    wait_for
    result=$?
    exit $result
else
    if [[ $WAITFORIT_TIMEOUT -gt 0 ]]; then
        wait_for_wrapper
        result=$?
    else
        wait_for
        result=$?
    fi
    if [[ ${#WAITFORIT_CLI[@]} -gt 0 ]]; then
        if [[ $result -ne 0 && $WAITFORIT_STRICT -eq 1 ]]; then
            echoerr "$WAITFORIT_cmdname: strict mode, refusing to execute subprocess"
            exit $result
        fi
        exec "${WAITFORIT_CLI[@]}"
    else
        exit $result
    fi
fi
