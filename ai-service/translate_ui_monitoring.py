import json
from deep_translator import GoogleTranslator

try:
    with open("../frontend/src/i18n/translations.js", "r", encoding="utf-8") as f:
        content = f.read()
except FileNotFoundError:
    print("File not found")
    exit()

# new strings for Monitoring
en_dict = {
    'pestMonitoring': 'PEST MONITORING',
    'trapIntelligence': 'Trap intelligence',
    'createFarmPlotFirst': 'Create a farm and plot first',
    'pestObsAttached': 'Pest observations are attached to a real plot.',
    'persistedFarmData': 'PERSISTED FARM DATA',
    'recentObservations': 'RECENT OBSERVATIONS',
    'loadingObservations': 'Loading observations…',
    'noTrapObsYet': 'No trap observations yet',
    'recordFieldObsBelow': 'Record a field observation below.',
    'addObservation': 'ADD OBSERVATION',
    'recordTrapCount': 'Record trap count',
    'trapType': 'Trap type',
    'pest': 'Pest',
    'egThrips': 'e.g. Thrips',
    'count': 'Count',
    'saveObservation': 'Save observation'
}

print("Translating to Telugu...")
translator = GoogleTranslator(source='en', target='te')
te_dict = {}

for key, text in en_dict.items():
    try:
        te_dict[key] = translator.translate(text)
    except Exception as e:
        print(f"Failed to translate {text}: {e}")
        te_dict[key] = text
        
import re
import ast

# Just inject them at the end of the en/te objects
def insert_keys(js, lang, dict_obj):
    # This is a very crude insertion, let's just use string replace before the closing brace of the language object
    # Find `en: {` and `te: {`
    lines = js.split("\n")
    for i, line in enumerate(lines):
        if line.strip().startswith(f"{lang}: {{"):
            # insert new keys
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

print("translations.js updated successfully.")
