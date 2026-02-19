
import { useState, useEffect } from 'react';

const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState({ x: null, y: null });

  useEffect(() => {
    const updateMousePosition = (ev:any) => {
      setMousePosition({ x: ev.clientX, y: ev.clientY });
    };

    // Attach the event listener to the window object to track movement anywhere on the page.
    window.addEventListener('mousemove', updateMousePosition);

    // Clean up the event listener when the component unmounts.
    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
    };
  }, []); 

  return mousePosition;
};

export default useMousePosition;
