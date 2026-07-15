"""
Gemini Vision Menu Parser
Pure Gemini AI vision-based menu extraction without OCR
"""

import os
import json
from dotenv import load_dotenv
import google.generativeai as genai
import PIL.Image

# Load environment variables
load_dotenv()


class VisionMenuParser:
    """Gemini Vision-only menu parser"""

    def __init__(self, api_key=None):
        """
        Initialize Gemini Vision parser

        Args:
            api_key: Gemini API key (optional, reads from GEMINI_API_KEY env var)
        """
        # Get API key
        if api_key is None:
            api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise ValueError(
                "Gemini API key required. Set GEMINI_API_KEY in .env or pass api_key parameter"
            )

        # Configure Gemini
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("models/gemini-2.5-flash")
        print("[OK] Gemini Vision initialized")

    def parse_deal(self, image_path):
        """
        Parse menu image and extract structured data

        Args:
            image_path: Path to menu image

        Returns:
            dict: Structured menu data with restaurant_name, deals, time_frame, special_conditions
        """
        print(f"\n{'=' * 70}")
        print(f"Processing: {image_path}")
        print(f"{'=' * 70}\n")

        try:
            # Load image
            print(f"Loading image: {image_path}")
            img = PIL.Image.open(image_path)
            img.load()  # Load into memory
            print(
                f"[OK] Image loaded - Size: {img.size}, Mode: {img.mode}, Format: {img.format}"
            )

            # Create prompt
            prompt = """Analyze this restaurant menu/happy hour deal image.

Extract the information in this EXACT JSON structure:
{
    "restaurant_name": "name if visible, otherwise null",
    "deals": [
        {
            "name": "item name",
            "price": "price as string (e.g., '$19.99', 'Free')",
            "description": "details about the deal or null"
        }
    ],
    "time_frame": [
        {
            "start_time": "e.g., '4:00 PM'",
            "end_time": "e.g., '7:00 PM'",
            "days": ["Monday", "Tuesday"] or null if not shown
        }
    ],
    "special_conditions": ["condition 1", "condition 2"] or null
}

Important:
- Extract ALL deals/items visible
- Use full day names (Monday, not Mon)
- Correct any OCR-like errors in text
- Include all restrictions/conditions
- Return ONLY valid JSON, no markdown formatting"""

            # Call Gemini Vision
            print("Analyzing image with Gemini Vision...")
            response = self.model.generate_content([prompt, img])
            response_text = response.text.strip()

            print(
                f"[DEBUG] Raw Gemini response length: {len(response_text)} characters"
            )
            print(f"[DEBUG] First 200 chars: {response_text[:200]}")
            print(f"[DEBUG] Full response:\n{response_text}\n")

            # Clean response (remove markdown if present)
            if response_text.startswith("```"):
                print("[DEBUG] Response has markdown formatting, cleaning...")
                json_text = response_text.split("```")[1]
                if json_text.startswith("json"):
                    json_text = json_text[4:]
                response_text = json_text.strip()
                print(f"[DEBUG] Cleaned response:\n{response_text}\n")

            # Parse JSON
            print("[DEBUG] Attempting to parse JSON...")
            data = json.loads(response_text)
            print(f"[DEBUG] JSON parsed successfully!")
            print(f"[DEBUG] Parsed data type: {type(data)}")
            print(
                f"[DEBUG] Parsed data keys: {data.keys() if isinstance(data, dict) else 'Not a dict'}"
            )

            print(f"[OK] Extracted data:")
            print(f"  Restaurant: {data.get('restaurant_name')}")
            deals = data.get("deals", [])
            print(f"  Deals: {len(deals) if deals else 0} items")
            time_frame = data.get("time_frame", [])
            print(f"  Time Frames: {len(time_frame) if time_frame else 0} slots")
            conditions = data.get("special_conditions", [])
            print(f"  Conditions: {len(conditions) if conditions else 0} items")

            return data

        except json.JSONDecodeError as e:
            print(f"[ERROR] Failed to parse JSON response: {e}")
            print(f"Response was: {response_text}")
            return {
                "restaurant_name": None,
                "deals": None,
                "time_frame": None,
                "special_conditions": None,
                "error": f"JSON parsing error: {str(e)}",
            }

        except Exception as e:
            print(f"[ERROR] Vision parsing failed: {e}")
            return {
                "restaurant_name": None,
                "deals": None,
                "time_frame": None,
                "special_conditions": None,
                "error": str(e),
            }

    def parse_to_json(self, image_path, pretty=True):
        """
        Parse menu and return as JSON string

        Args:
            image_path: Path to menu image
            pretty: Pretty print JSON (default: True)

        Returns:
            str: JSON string
        """
        data = self.parse_deal(image_path)
        return json.dumps(data, indent=2 if pretty else None)


def main():
    """Example usage"""
    import argparse

    parser = argparse.ArgumentParser(description="Parse menu image with Gemini Vision")
    parser.add_argument("image", help="Path to menu image")
    parser.add_argument("--output", "-o", help="Output JSON file (optional)")

    args = parser.parse_args()

    # Initialize parser
    parser = VisionMenuParser()

    # Parse menu
    data = parser.parse_deal(args.image)

    # Print result
    print(f"\n{'=' * 70}")
    print("EXTRACTED DATA:")
    print(f"{'=' * 70}")
    print(json.dumps(data, indent=2))

    # Save to file if specified
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"\n[OK] Saved to: {args.output}")


if __name__ == "__main__":
    main()
