import json
from deep_translator import GoogleTranslator

en_dict = {
    'dashboard': 'Dashboard', 'crops': 'My Crops', 'scanner': 'Crop Scanner',
    'risk': 'Risk Forecast', 'alerts': 'Alerts', 'monitoring': 'Pest Monitoring',
    'map': 'Disease Map', 'knowledge': 'Knowledge Center', 'assistant': 'AI Assistant',
    'actions': 'Action Plans', 'reports': 'Reports', 'officer': 'Officer Desk',
    'settings': 'Settings', 'goodMorning': 'Good morning', 
    'attention': 'Here’s what needs your attention today.', 'farmHealth': 'Farm health',
    'viewRisk': 'View risk', 'scan': 'Scan crop', 'online': 'Online',
    'offline': 'Offline', 'sync': 'Sync now', 'high': 'High', 'moderate': 'Moderate',
    'stable': 'Stable', 'mapMyFarm': 'MAP MY FARM', 'spatialMonitoring': 'Spatial monitoring',
    'standardMap': 'Standard map', 'satelliteView': 'Satellite view',
    'satelliteImageryDesc': 'Satellite imagery is a visual reference only. The saved boundary comes from farmer-confirmed map boundaries.',
    'selectFarm': 'Select farm', 'drawFarm': 'Draw farm', 'drawPlot': 'Draw plot',
    'undo': 'Undo', 'clear': 'Clear', 'drawing': 'Drawing:', 'farmBoundary': 'farm boundary',
    'customPlot': 'custom plot', 'area': 'Area:', 'confirmFarmBoundary': 'Confirm farm boundary',
    'createFarm': 'CREATE FARM', 'farmName': 'Farm name', 'sayFarmName': 'Say farm name',
    'crop': 'Crop', 'growthStage': 'Growth stage', 'latitude': 'Latitude', 'longitude': 'Longitude',
    'useMyLocation': 'Use my location', 'createSpatialFarm': 'Create spatial farm',
    'customPlotsOptional': 'CUSTOM PLOTS (OPTIONAL)', 'plotIdName': 'Plot ID/name',
    'sayPlotName': 'Say plot name', 'saveCustomPlot': 'Save custom plot',
    'mainPlotAuto': 'A main plot is created automatically if you just want to monitor the entire farm.',
    'plotDetails': 'PLOT DETAILS', 'stageNotRecorded': 'stage not recorded',
    'areaSmall': 'Area', 'trapRecords': 'Trap records', 'nearbyRisk': 'Nearby risk',
    'noRiskCalculation': 'No risk calculation yet. Add a scan or trap observation.',
    'selectPlotViewHistory': 'Select or create a plot to view its history.',
    'sign_in_to_map': 'Sign in to map a farm',
    'seedling': 'Seedling', 'vegetative': 'Vegetative', 'flowering': 'Flowering', 'fruiting': 'Fruiting', 'harvest': 'Harvest',
    
    # Scanner.jsx specific
    'upload_photo': 'Upload photo for analysis',
    'take_photo': 'Take photo',
    'disease_scanner': 'DISEASE SCANNER',
    'detect_pests': 'Detect pests and diseases',
    'analyze': 'Analyze',
    'scan_results': 'SCAN RESULTS',
    'condition': 'Condition',
    'confidence': 'Confidence',
    'severity': 'Severity',
    'no_issues': 'No issues detected',
    'no_pests': 'No pests detected',
    'healthy': 'Healthy',
    'recommendations': 'RECOMMENDATIONS',
    'save_to_plot': 'Save to plot history',
    'saved': 'Saved!',
    'play_audio': 'Play Audio',
    'stop_audio': 'Stop',
    'loading': 'Loading...',
    'demo_mode': 'Demo Mode',
    'demo_desc': 'Using local YOLO model'
}

print("Translating to Telugu...")
translator = GoogleTranslator(source='en', target='te')
te_dict = {}

# Batch translate to avoid rate limits
for key, text in en_dict.items():
    try:
        te_dict[key] = translator.translate(text)
    except Exception as e:
        print(f"Failed to translate {text}: {e}")
        te_dict[key] = text

# Format as JS
js_content = "export const translations = {\n"
js_content += "  en: " + json.dumps(en_dict, ensure_ascii=False) + ",\n"
js_content += "  te: " + json.dumps(te_dict, ensure_ascii=False) + "\n"
js_content += "};\n"

with open("../frontend/src/i18n/translations.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("translations.js updated successfully.")
