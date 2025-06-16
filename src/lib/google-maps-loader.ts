// Google Maps API loader utility

let isLoading = false;
let isLoaded = false;

export const loadGoogleMapsAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (isLoaded) {
      resolve();
      return;
    }

    // Currently loading
    if (isLoading) {
      const checkLoaded = () => {
        if (isLoaded) {
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    isLoading = true;

    // Check if API key is available
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error('Google Maps API key not configured'));
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=beta&libraries=maps3d`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isLoaded = true;
      isLoading = false;
      resolve();
    };

    script.onerror = () => {
      isLoading = false;
      reject(new Error('Failed to load Google Maps API'));
    };

    // Append script to head
    document.head.appendChild(script);
  });
};

export const isGoogleMapsLoaded = (): boolean => {
  return isLoaded && typeof google !== 'undefined' && google.maps;
};