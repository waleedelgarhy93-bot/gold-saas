"""
Gemini Vision Service for Egyptian Gold SaaS
Extracts structured JSON from:
1. Egyptian National ID cards
2. Bullion cards (BTC, Lazurde, SAM, etc.)
3. Gold Hallmarks (دمغة الذهب)
4. Purchase receipts
"""
import os
import json
import base64
import httpx
from typing import Optional, Dict, Any
from pydantic import BaseModel

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

VISION_SYSTEM_PROMPT = """أنت مساعد ذكي فائق الدقة متخصص في محلات الصاغة وتجارة الذهب والمجوهرات في مصر والوطن العربي.
مهمتك فحص الصور الملتقطة بكاميرا الكاشير أو المرفوعة واستخراج البيانات في صيغة JSON دقيقة ومحددة فقط بدون أي مقدمات أو شروحات.

الصور المحتملة هي:
1. بطاقة الرقم القومي المصرية (National ID):
   - استخرج: الاسم الرباعي/الثلاثي كما هو مكتوب بدقة، الرقم القومي المكون من 14 رقماً، والعنوان إن وجد.
2. غلاف سبيكة أو كارت تغليف (Bullion Card مثل BTC أو لازوردي أو ماستر جولد):
   - استخرج: اسم الشركة/الماركة (Brand)، السيريال نمبر (Serial Number)، الوزن المصرح به بالجرام (Weight in grams)، العيار (Karat: 24 أو 21)، وكود الباركود المطبوع إن كان مرئياً.
3. دمغة الذهب (Hallmark):
   - استخرج: رمز العيار المقروء (مثلاً 875 لـ 21، أو 750 لـ 18، أو 24K)، ورمز الختم (زهرة اللوتس، أو الحرف التاريخي)، وتقييم وضوح الدمغة (clear | distorted | suspicious).
4. فاتورة قديمة أو كارت ضمان (Old Invoice):
   - استخرج اسم المحل، التاريخ، الوزن، والعيار.

يجب أن يكون الناتج حصراً كائن JSON بهذه الهيكلية الصارمة:
{
  "detected_type": "national_id | bullion_card | hallmark | invoice | unknown",
  "confidence_score": 0.95,
  "customer": {
    "name": "الاسم هنا أو null",
    "national_id": "14 رقما هنا أو null",
    "address": "العنوان أو null"
  },
  "gold_item": {
    "brand": "BTC / Lazurde / etc أو null",
    "serial_number": "السيريال أو null",
    "karat": 21,
    "declared_weight": 10.0,
    "hallmark_text": "الرموز المقروءة أو null",
    "hallmark_status": "clear | faint | distorted | suspicious | unverified",
    "notes": "ملاحظات فحص الختم أو الكارت"
  },
  "raw_text": "ملخص النص المستخرج بدقة"
}
"""

async def analyze_image_with_gemini(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Send image to Gemini Vision API and return structured JSON."""
    key = api_key or os.getenv("GEMINI_API_KEY", "")
    if not key:
        return {
            "success": False,
            "error": "لم يتم ضبط مفتاح GEMINI_API_KEY. يرجى إدخاله في الإعدادات أو ملف .env"
        }

    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": VISION_SYSTEM_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": b64_image
                        }
                    },
                    {"text": "افحص هذه الصورة الآن واستخرج بيانات الـ JSON بدقة متناهية:"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }

    url = f"{GEMINI_API_URL}?key={key}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": f"Gemini API Error {response.status_code}: {response.text}"
                }
            
            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return {"success": False, "error": "لم يتم العثور على رد من النموذج"}
            
            content_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
            parsed_json = json.loads(content_text)
            return {"success": True, "data": parsed_json}
            
        except json.JSONDecodeError:
            return {"success": False, "error": "تعذر تحويل رد الذكاء الاصطناعي إلى JSON", "raw": content_text}
        except Exception as e:
            return {"success": False, "error": f"حدث خطأ أثناء فحص الصورة: {str(e)}"}
