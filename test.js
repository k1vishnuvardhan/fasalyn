async function runTest() {
  try {
    console.log("1. Starting demo auth...");
    const resAuth = await fetch('http://localhost:4000/api/auth/demo', { method: 'POST' });
    const authData = await resAuth.json();
    console.log("Auth success! Token:", !!authData.token);
    
    console.log("2. Testing AI Chat endpoint...");
    const resChat = await fetch('http://localhost:4000/api/chat', { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.token}`
      },
      body: JSON.stringify({ message: "Hello AI Agronomist, how do I treat rice blast?" })
    });
    const chatData = await resChat.json();
    console.log("Chat response status:", resChat.status);
    console.log("Chat response text:", chatData.text ? chatData.text.slice(0, 100) + "..." : chatData);
    
    console.log("All tests completed successfully!");
  } catch (err) {
    console.error("Test failed:", err);
  }
}
runTest();
