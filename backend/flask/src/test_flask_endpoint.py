#!/usr/bin/env python3
"""
Test script for the new restaurant search Flask endpoint
"""

import requests


def test_restaurant_search_endpoint():
    """Test the new /search-restaurants-by-name Flask endpoint"""

    base_url = "http://localhost:5000"

    print("=" * 60)
    print("Testing Flask Restaurant Search Endpoint")
    print("=" * 60)

    # Test 1: Basic search with coordinates
    print("\n1. Testing basic search with coordinates...")
    url = f"{base_url}/search-restaurants-by-name?name=starbucks&lat=40.7127&lon=-74.0060&radius=2000"

    try:
        response = requests.get(url, timeout=10)
        print(f"URL: {url}")
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success')}")
            print(f"Count: {data.get('count')}")

            if data.get("data"):
                print("First restaurant found:")
                restaurant = data["data"][0]
                print(f"  Name: {restaurant['venue_name']}")
                print(f"  Address: {restaurant['address']['street']}")
                print(f"  Distance: {restaurant['distance_meters']} meters")
            else:
                print("No restaurants found")
        else:
            print(f"Error: {response.text}")

    except Exception as e:
        print(f"Request failed: {e}")

    # Test 2: Error case - missing parameters
    print("\n2. Testing error case (missing lat/lon)...")
    url = f"{base_url}/search-restaurants-by-name?name=starbucks"

    try:
        response = requests.get(url, timeout=10)
        print(f"URL: {url}")
        print(f"Status Code: {response.status_code}")

        if response.status_code == 400:
            data = response.json()
            print(f"Expected error: {data.get('error')}")
        else:
            print(f"Unexpected response: {response.text}")

    except Exception as e:
        print(f"Request failed: {e}")

    # Test 3: Search for specific restaurant
    print("\n3. Testing specific restaurant search...")
    url = f"{base_url}/search-restaurants-by-name?name=china%20star%20express&lat=40.7127&lon=-74.0060&limit=5"

    try:
        response = requests.get(url, timeout=10)
        print(f"URL: {url}")
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success')}")
            print(f"Count: {data.get('count')}")

            if data.get("data"):
                for i, restaurant in enumerate(data["data"], 1):
                    print(f"\nRestaurant {i}:")
                    print(f"  Name: {restaurant['venue_name']}")
                    print(f"  Address: {restaurant['address']['street']}")
                    print(f"  City: {restaurant['address']['city']}")
                    print(f"  Distance: {restaurant['distance_meters']} meters")
            else:
                print("No China Star Express restaurants found")
        else:
            print(f"Error: {response.text}")

    except Exception as e:
        print(f"Request failed: {e}")

    print("\n" + "=" * 60)
    print("Test completed!")
    print("Start your Flask server with: python main.py")
    print("Then run this test script again.")
    print("=" * 60)


if __name__ == "__main__":
    test_restaurant_search_endpoint()

