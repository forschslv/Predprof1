// STUDENT FUNCTIONS
async function loadStudentData() {
    const studentPanel = document.getElementById('studentPanel');
    if (studentPanel) {
        studentPanel.classList.remove('hidden');
        
        // Load profile
        document.getElementById('profileName').innerText = currentUser.name;
        document.getElementById('profileSecondaryName').innerText = currentUser.secondary_name;
        document.getElementById('profileEmail').innerText = currentUser.email;
        document.getElementById('profileStatus').innerText = currentUser.status;
        document.getElementById('profileClass').innerText = "10А"; // Would come from backend
        document.getElementById('profileTeacher').innerText = "Иванова М.П."; // Would come from backend
        
        // Load module menu
        await loadModuleMenu();
        
        // Load orders
        await loadMyOrders();
    } else {
        console.warn('Student panel not found in current page context');
    }
}