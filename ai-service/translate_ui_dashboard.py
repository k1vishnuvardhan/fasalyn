import json
from deep_translator import GoogleTranslator
import re

try:
    with open("../frontend/src/i18n/translations.js", "r", encoding="utf-8") as f:
        content = f.read()
except FileNotFoundError:
    print("File not found")
    exit()

en_dict = {
    'farmIntelligence': 'FARM INTELLIGENCE',
    'signInViewFarmData': 'Sign in to view farm data',
    'loadingFarmData': 'Loading farm data…',
    'totalScans': 'Total scans',
    'pestObservations': 'Pest observations',
    'openOfficerCases': 'Open officer cases',
    'yourPlots': 'Your plots',
    'noPlotsYet': 'No plots yet',
    'createFarmPlotToBegin': 'Create a farm and plot to begin recording field data.',
    'cropStageNotRecorded': 'Crop stage not recorded'
}

translator = GoogleTranslator(source='en', target='te')
te_dict = {}

for key, text in en_dict.items():
    try:
        te_dict[key] = translator.translate(text)
    except Exception as e:
        te_dict[key] = text
        
def insert_keys(js, lang, dict_obj):
    lines = js.split("\n")
    for i, line in enumerate(lines):
        if line.strip().startswith(f"{lang}: {{"):
            new_lines = []
            for k, v in dict_obj.items():
                v = v.replace('"', '\\"')
                new_lines.append(f'    "{k}": "{v}",')
            lines.insert(i+1, "\n".join(new_lines))
            break
    return "\n".join(lines)

new_content = insert_keys(content, "te", te_dict)
new_content = insert_keys(new_content, "en", en_dict)

with open("../frontend/src/i18n/translations.js", "w", encoding="utf-8") as f:
    f.write(new_content)
