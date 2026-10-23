# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations

# More languages for Admin → Talen: all off by default, the administrator switches on what the website offers.
LANGUAGES = [
    ("it", "Italiaans", "Italiano", False), ("ru", "Russisch", "Русский", False), ("ja", "Japans", "日本語", False), ("ko", "Koreaans", "한국어", False),
    ("hi", "Hindi", "हिन्दी", False), ("tr", "Turks", "Türkçe", False), ("pl", "Pools", "Polski", False), ("sv", "Zweeds", "Svenska", False),
    ("da", "Deens", "Dansk", False), ("no", "Noors", "Norsk", False), ("fi", "Fins", "Suomi", False), ("el", "Grieks", "Ελληνικά", False),
    ("cs", "Tsjechisch", "Čeština", False), ("hu", "Hongaars", "Magyar", False), ("ro", "Roemeens", "Română", False), ("uk", "Oekraïens", "Українська", False),
    ("id", "Indonesisch", "Bahasa Indonesia", False), ("th", "Thais", "ไทย", False), ("vi", "Vietnamees", "Tiếng Việt", False), ("he", "Hebreeuws", "עברית", True),
    ("fa", "Perzisch", "فارسی", True), ("ur", "Urdu", "اردو", True), ("bn", "Bengaals", "বাংলা", False), ("bg", "Bulgaars", "Български", False),
    ("hr", "Kroatisch", "Hrvatski", False), ("sk", "Slowaaks", "Slovenčina", False), ("sl", "Sloveens", "Slovenščina", False), ("sr", "Servisch", "Српски", False),
    ("lt", "Litouws", "Lietuvių", False), ("lv", "Lets", "Latviešu", False), ("et", "Estisch", "Eesti", False), ("ca", "Catalaans", "Català", False),
    ("ms", "Maleis", "Bahasa Melayu", False), ("tl", "Filipijns", "Filipino", False), ("sw", "Swahili", "Kiswahili", False), ("af", "Afrikaans", "Afrikaans", False),
]


def seed(apps, schema_editor):
    Language = apps.get_model("core", "Language")
    start = (Language.objects.order_by("-order").values_list("order", flat=True).first() or 0) + 1
    for i, (code, name, native, rtl) in enumerate(LANGUAGES):
        Language.objects.get_or_create(code=code, defaults={"name": name, "native_name": native, "rtl": rtl, "order": start + i, "enabled": False, "is_default": False})


class Migration(migrations.Migration):
    dependencies = [("core", "0016_license_price")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
