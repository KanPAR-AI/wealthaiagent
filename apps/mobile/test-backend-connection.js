#!/usr/bin/env node

// Simple script to test backend connectivity
const testBackendConnection = async () => {
  const urls = [
    'http://localhost:8080/api/v1/auth/token',
    'http://10.0.2.2:8080/api/v1/auth/token'
  ];

  for (const url of urls) {
    try {
      console.log(`\nTesting connection to: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'username=test_username&password=kzjdbv',
      });
      
      if (response.ok) {
        console.log(`✅ SUCCESS: ${url} is accessible`);
        const data = await response.json();
        console.log('Response:', data);
      } else {
        console.log(`❌ FAILED: ${url} returned status ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${url} - ${error.message}`);
    }
  }
};

testBackendConnection();
