document.addEventListener('DOMContentLoaded', function() {
    const dropdownTrigger = document.querySelector('.dropdown-trigger');
    const dropdownContent = document.querySelector('.dropdown-content');
    const container = document.querySelector('.spotify-dropdown-container');
    
    // Combined click and touch handler
    function toggleDropdown(event) {
        event.preventDefault();
        event.stopPropagation();
        
        dropdownTrigger.classList.toggle('active');
        dropdownContent.classList.toggle('active');
        container.classList.toggle('active');
        
        // For mobile: scroll into view if needed
        if (window.innerWidth <= 768 && dropdownContent.classList.contains('active')) {
            setTimeout(() => {
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }
    
    // Add both click and touch events
    dropdownTrigger.addEventListener('click', toggleDropdown);
    dropdownTrigger.addEventListener('touchstart', toggleDropdown, { passive: false });
    
    // Close dropdown when clicking/touching outside
    document.addEventListener('click', function(event) {
        if (!container.contains(event.target)) {
            dropdownTrigger.classList.remove('active');
            dropdownContent.classList.remove('active');
            container.classList.remove('active');
        }
    });
    
    // Prevent closing when clicking inside iframe
    dropdownContent.addEventListener('click', function(event) {
        event.stopPropagation();
    });
}); 