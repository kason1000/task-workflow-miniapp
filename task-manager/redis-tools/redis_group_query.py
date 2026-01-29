#!/usr/bin/env python3
"""
Script to query all group information from Redis and display it.
"""

import redis
import json
import argparse
from typing import Dict, List, Any


def connect_to_redis(host='localhost', port=6379, db=0, password=None):
    """Connect to Redis instance."""
    try:
        r = redis.Redis(
            host=host,
            port=port,
            db=db,
            password=password,
            decode_responses=True
        )
        # Test connection
        r.ping()
        print(f"Connected to Redis at {host}:{port}")
        return r
    except Exception as e:
        print(f"Error connecting to Redis: {e}")
        return None


def get_all_keys(r, pattern="group:*"):
    """Get all keys matching the pattern."""
    try:
        keys = r.keys(pattern)
        return keys
    except Exception as e:
        print(f"Error getting keys: {e}")
        return []


def get_group_info(r, key):
    """Get information for a specific group key."""
    try:
        key_type = r.type(key)
        
        if key_type == 'string':
            value = r.get(key)
            return {'type': 'string', 'value': value}
        elif key_type == 'hash':
            value = r.hgetall(key)
            return {'type': 'hash', 'value': value}
        elif key_type == 'list':
            value = r.lrange(key, 0, -1)
            return {'type': 'list', 'value': value}
        elif key_type == 'set':
            value = r.smembers(key)
            return {'type': 'set', 'value': value}
        elif key_type == 'zset':
            value = r.zrange(key, 0, -1, withscores=True)
            return {'type': 'zset', 'value': value}
        else:
            return {'type': key_type, 'value': 'Unknown type'}
    except Exception as e:
        return {'error': str(e)}


def query_groups(r, patterns=["group:*", "groups:*", "*:group*", "*:groups*"]):
    """Query Redis for all group-related information."""
    all_groups = {}
    
    for pattern in patterns:
        print(f"\nSearching for keys matching pattern: {pattern}")
        keys = get_all_keys(r, pattern)
        
        if not keys:
            print(f"No keys found for pattern: {pattern}")
            continue
            
        print(f"Found {len(keys)} keys for pattern: {pattern}")
        
        for key in keys:
            group_info = get_group_info(r, key)
            all_groups[key] = group_info
    
    return all_groups


def display_group_info(groups):
    """Display group information in a formatted way."""
    if not groups:
        print("\nNo group information found in Redis.")
        return
    
    print(f"\n--- Found {len(groups)} group-related entries ---")
    
    for key, info in groups.items():
        print(f"\nKey: {key}")
        print(f"Type: {info['type']}")
        
        if 'error' in info:
            print(f"Error: {info['error']}")
        else:
            value = info['value']
            
            if isinstance(value, dict):
                print("Value:")
                for k, v in value.items():
                    print(f"  {k}: {v}")
            elif isinstance(value, list) or isinstance(value, set):
                print("Value:")
                for item in value:
                    print(f"  - {item}")
            elif isinstance(value, str):
                # Try to parse as JSON if it looks like it might be
                if value.startswith('{') or value.startswith('['):
                    try:
                        parsed_value = json.loads(value)
                        print("Value (JSON):")
                        print(json.dumps(parsed_value, indent=2))
                    except json.JSONDecodeError:
                        print(f"  Value: {value}")
                else:
                    print(f"  Value: {value}")
            else:
                print(f"  Value: {value}")
        
        print("-" * 40)


def main():
    parser = argparse.ArgumentParser(description='Query all group information from Redis')
    parser.add_argument('--host', default='localhost', help='Redis host (default: localhost)')
    parser.add_argument('--port', type=int, default=6379, help='Redis port (default: 6379)')
    parser.add_argument('--db', type=int, default=0, help='Redis database (default: 0)')
    parser.add_argument('--password', help='Redis password (if required)')
    parser.add_argument('--pattern', action='append', dest='patterns', 
                       help='Custom pattern to search for (can be used multiple times)')
    
    args = parser.parse_args()
    
    # Connect to Redis
    r = connect_to_redis(args.host, args.port, args.db, args.password)
    if not r:
        return
    
    # Set default patterns if none provided
    if args.patterns:
        patterns = args.patterns
    else:
        patterns = ["group:*", "groups:*", "*:group*", "*:groups*"]
    
    # Query for group information
    groups = query_groups(r, patterns)
    
    # Display the results
    display_group_info(groups)


if __name__ == "__main__":
    main()