#!/bin/bash

# Script to query all group information from Redis and display it

# Default values
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_DB=${REDIS_DB:-0}
REDIS_PASSWORD=${REDIS_PASSWORD:-}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to execute Redis command
execute_redis_command() {
    local command="$1"
    
    if [ -n "$REDIS_PASSWORD" ]; then
        result=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -n "$REDIS_DB" -a "$REDIS_PASSWORD" $command 2>/dev/null)
    else
        result=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -n "$REDIS_DB" $command 2>/dev/null)
    fi
    
    if [ $? -ne 0 ]; then
        print_error "Failed to execute Redis command: $command"
        exit 1
    fi
    
    echo "$result"
}

# Check if redis-cli is available
if ! command -v redis-cli &> /dev/null; then
    print_error "redis-cli is not installed or not in PATH"
    exit 1
fi

# Test connection
print_status "Testing connection to Redis at $REDIS_HOST:$REDIS_PORT..."
ping_result=$(execute_redis_command "PING")
if [ "$ping_result" != "PONG" ]; then
    print_error "Could not connect to Redis: $ping_result"
    exit 1
else
    print_success "Connected to Redis successfully"
fi

# Get all keys related to groups
print_status "Searching for group-related keys..."

# Array of patterns to search for
patterns=("group:*" "groups:*" "*:group*" "*:groups*" "chat:*" "room:*" "channel:*")

all_group_keys=()

for pattern in "${patterns[@]}"; do
    print_status "Searching for pattern: $pattern"
    keys=$(execute_redis_command "KEYS $pattern")
    
    if [ -n "$keys" ] && [ "$keys" != "(nil)" ]; then
        # Convert newline-separated keys to array
        while IFS= read -r key; do
            if [ -n "$key" ] && [ "$key" != "(nil)" ]; then
                all_group_keys+=("$key")
                print_success "Found key: $key"
            fi
        done <<< "$keys"
    else
        print_warning "No keys found for pattern: $pattern"
    fi
done

if [ ${#all_group_keys[@]} -eq 0 ]; then
    print_warning "No group-related keys found in Redis"
    exit 0
fi

print_status "Found ${#all_group_keys[@]} total group-related keys"

# Process each key and display its content
echo
echo "==============================================="
echo "GROUP INFORMATION FROM REDIS"
echo "==============================================="

for key in "${all_group_keys[@]}"; do
    echo
    echo "-----------------------------------------------"
    echo "Key: $key"
    
    # Get the type of the key
    key_type=$(execute_redis_command "TYPE $key")
    echo "Type: $key_type"
    
    # Get TTL of the key (time to live)
    ttl=$(execute_redis_command "TTL $key")
    if [ "$ttl" = "-1" ]; then
        echo "TTL: Permanent (no expiration)"
    elif [ "$ttl" = "-2" ]; then
        echo "TTL: Key does not exist"
    else
        echo "TTL: $ttl seconds"
    fi
    
    echo "Content:"
    
    case $key_type in
        "string")
            value=$(execute_redis_command "GET $key")
            echo "  $value"
            ;;
        "hash")
            hash_content=$(execute_redis_command "HGETALL $key")
            if [ -n "$hash_content" ]; then
                # Format hash content nicely
                echo "$hash_content" | xargs -n2 printf "  %s: %s\n"
            else
                echo "  (empty)"
            fi
            ;;
        "list")
            list_length=$(execute_redis_command "LLEN $key")
            echo "  List length: $list_length"
            if [ "$list_length" -gt 0 ]; then
                items=$(execute_redis_command "LRANGE $key 0 -1")
                count=0
                while IFS= read -r item; do
                    if [ -n "$item" ]; then
                        echo "  [$count]: $item"
                        ((count++))
                    fi
                done <<< "$items"
            fi
            ;;
        "set")
            set_members=$(execute_redis_command "SMEMBERS $key")
            member_count=$(execute_redis_command "SCARD $key")
            echo "  Set cardinality: $member_count"
            if [ "$member_count" -gt 0 ]; then
                while IFS= read -r member; do
                    if [ -n "$member" ]; then
                        echo "  - $member"
                    fi
                done <<< "$set_members"
            fi
            ;;
        "zset")
            zset_card=$(execute_redis_command "ZCARD $key")
            echo "  Sorted set cardinality: $zset_card"
            if [ "$zset_card" -gt 0 ]; then
                members_with_scores=$(execute_redis_command "ZRANGE $key 0 -1 WITHSCORES")
                # Print pairs of value and score
                echo "$members_with_scores" | sed 'N;s/\n/ : /'
            fi
            ;;
        *)
            print_warning "  Unknown key type: $key_type"
            ;;
    esac
done

echo
echo "==============================================="
print_success "Group information retrieval completed"