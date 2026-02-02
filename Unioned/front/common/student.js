// STUDENT FUNCTIONS
async function loadStudentData() {
    const studentPanel = document.getElementById('studentPanel');
    if (studentPanel) {
        studentPanel.classList.remove('hidden');
        
        // Load profile
        document.getElementById('profileName').innerText = window.currentUser.name;
        document.getElementById('profileSecondaryName').innerText = window.currentUser.secondary_name;
        document.getElementById('profileEmail').innerText = window.currentUser.email;
        document.getElementById('profileStatus').innerText = window.currentUser.status;
        document.getElementById('profileClass').innerText = "10А"; // Would come from backend
        document.getElementById('profileTeacher').innerText = "Иванова М.П."; // Would come from backend
        
        // Load module menu
        await loadModuleMenu();
        
        // Load orders
        await loadMyOrders();
    } else {
        console.warn('Student panel not found in current page context');
        // Redirect to orders page if student panel is not available
        redirectToOrdersPage();
    }
}

// Function to redirect to orders page with pricing info from server
async function redirectToOrdersPage() {
    try {
        // Fetch user profile info to include in the redirect
        const response = await fetch(`${window.API_BASE}/users/me`, {
            headers: {
                'Authorization': `Bearer ${window.currentToken}`
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            window.currentUser = userData;
            
            // Check if we're already on the orders page
            if (!window.location.pathname.includes('/orders/')) {
                // Redirect to the orders page
                window.location.href = '../orders/index.html';
            }
        } else {
            console.error('Failed to fetch user data for redirect');
            // Still redirect to orders page, but without fresh user data
            if (!window.location.pathname.includes('/orders/')) {
                window.location.href = '../orders/index.html';
            }
        }
    } catch (error) {
        console.error('Error during redirect:', error);
        // Redirect anyway to avoid getting stuck
        if (!window.location.pathname.includes('/orders/')) {
            window.location.href = '../orders/index.html';
        }
    }
}