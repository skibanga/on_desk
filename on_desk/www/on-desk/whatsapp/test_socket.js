/**
 * WhatsApp Test Socket.js
 * 
 * This file contains test functionality for WhatsApp real-time messaging.
 * It's based on the successful implementation from the Velocetec app.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Create the test container
    var container = document.createElement('div');
    container.className = 'test-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.backgroundColor = '#fff';
    container.style.padding = '15px';
    container.style.borderRadius = '5px';
    container.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.2)';
    container.style.maxWidth = '300px';
    container.style.display = 'none'; // Hidden by default
    
    // Create the test content
    container.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 10px;">WhatsApp Test Panel</h3>
        <div style="margin-bottom: 10px;">
            <label for="test-phone">Phone Number:</label>
            <input type="text" id="test-phone" value="255789968024" style="width: 100%; padding: 5px; margin-top: 5px;">
        </div>
        <div style="margin-bottom: 10px;">
            <label for="test-message">Message:</label>
            <textarea id="test-message" style="width: 100%; padding: 5px; margin-top: 5px; height: 60px;">Test message from WhatsApp test panel</textarea>
        </div>
        <div style="display: flex; justify-content: space-between;">
            <button id="send-test-event" style="padding: 8px 15px; background-color: #16526e; color: white; border: none; border-radius: 3px; cursor: pointer;">Send Test Event</button>
            <button id="close-test-panel" style="padding: 8px 15px; background-color: #ccc; color: #333; border: none; border-radius: 3px; cursor: pointer;">Close</button>
        </div>
        <div id="test-status" style="margin-top: 10px; font-size: 12px; color: #666;"></div>
    `;
    
    // Add the container to the body
    document.body.appendChild(container);
    
    // Create the toggle button
    var toggleButton = document.createElement('button');
    toggleButton.textContent = 'Test WhatsApp';
    toggleButton.style.position = 'fixed';
    toggleButton.style.bottom = '20px';
    toggleButton.style.right = '20px';
    toggleButton.style.zIndex = '9998';
    toggleButton.style.backgroundColor = '#16526e';
    toggleButton.style.color = 'white';
    toggleButton.style.padding = '8px 15px';
    toggleButton.style.borderRadius = '3px';
    toggleButton.style.border = 'none';
    toggleButton.style.cursor = 'pointer';
    
    // Add the toggle button to the body
    document.body.appendChild(toggleButton);
    
    // Toggle the test container when the button is clicked
    toggleButton.addEventListener('click', function() {
        if (container.style.display === 'none') {
            container.style.display = 'block';
            toggleButton.style.display = 'none';
        } else {
            container.style.display = 'none';
            toggleButton.style.display = 'block';
        }
    });
    
    // Close the test container when the close button is clicked
    document.getElementById('close-test-panel').addEventListener('click', function() {
        container.style.display = 'none';
        toggleButton.style.display = 'block';
    });
    
    // Send a test event when the send button is clicked
    document.getElementById('send-test-event').addEventListener('click', function() {
        var phone = document.getElementById('test-phone').value;
        var message = document.getElementById('test-message').value;
        
        if (!phone || !message) {
            document.getElementById('test-status').textContent = 'Please enter both phone number and message';
            return;
        }
        
        document.getElementById('test-status').textContent = 'Sending test event...';
        
        // Call the API to send a test event
        send_test_event(phone, message);
    });
    
    // Function to send a test event
    function send_test_event(phone, message) {
        // Use jQuery AJAX to call the API
        $.ajax({
            url: '/api/method/on_desk.on_desk.doctype.od_whatsapp_integration.api.test_whatsapp_event',
            type: 'POST',
            data: {
                phone_number: phone,
                message: message
            },
            headers: {
                'X-Frappe-CSRF-Token': frappe.csrf_token || ''
            },
            success: function(data) {
                if (data.message && data.message.success) {
                    document.getElementById('test-status').textContent = 'Test event sent successfully!';
                    console.log('Test event sent successfully:', data.message);
                } else {
                    document.getElementById('test-status').textContent = 'Failed to send test event';
                    console.error('Failed to send test event:', data);
                }
            },
            error: function(xhr, status, error) {
                document.getElementById('test-status').textContent = 'Error: ' + error;
                console.error('Error sending test event:', xhr, status, error);
            }
        });
    }
});

console.log("WhatsApp test_socket.js loaded");
