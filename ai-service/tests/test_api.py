from fastapi.testclient import TestClient
import main

client = TestClient(main.app)
def test_same_language_returns_input():
    response=client.post('/translate',json={'text':'Farm risk is high','sourceLanguage':'en','targetLanguage':'en'})
    assert response.status_code==200 and response.json()['translatedText']=='Farm risk is high'
def test_rejects_empty_translation():
    assert client.post('/translate',json={'text':'','sourceLanguage':'en','targetLanguage':'te'}).status_code==422
def test_rejects_unsupported_tts_language():
    assert client.post('/tts',json={'text':'test','language':'en'}).status_code==422
def test_model_unavailable_is_honest():
    if not main.translator.ready:
        assert client.post('/translate',json={'text':'Farm risk','sourceLanguage':'en','targetLanguage':'te'}).status_code==503
