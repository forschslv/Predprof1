// Dish type constants and utilities
// Make function globally available
try {
    API_BASE = "http://localhost:8000";
} catch (e) {
    console.error("Error initializing API_BASE:", e);
}
window.DISH_TYPES = {
    MAIN: { key: 'MAIN', name: 'Второе горячее блюдо' },
    GARNISH: { key: 'GARNISH', name: 'Гарнир' },
    PREPARED: { key: 'PREPARED', name: 'Готовое кулинарное блюдо' },
    DRINK: { key: 'DRINK', name: 'Напиток' },
    SALAD: { key: 'SALAD', name: 'Салат' },
    SOUP: { key: 'SOUP', name: 'Суп' },
    BREAD: { key: 'BREAD', name: 'Хлеб' }
};

window.getDishTypeName = function(type) {
    const typeNames = {
        'MAIN': 'Второе горячее блюдо',
        'GARNISH': 'Гарнир',
        'PREPARED': 'Готовое кулинарное блюдо',
        'DRINK': 'Напиток',
        'SALAD': 'Салат',
        'SOUP': 'Суп',
        'BREAD': 'Хлеб'
    };
    return typeNames[type] || type;
};

window.getDishTypesArray = function() {
    return Object.values(window.DISH_TYPES);
};