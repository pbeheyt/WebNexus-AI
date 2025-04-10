import React, { useState, useEffect, useRef, useCallback } from 'react';
import baseLogger from '../../shared/logger.js'; // Import the base logger object
const logger = baseLogger.content; // Access the content logger

// Simple Sidebar Icon SVG (Replace with your preferred icon)
const SidebarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
  </svg>
);


const FloatingActionButton = ({ onClick, isVisible }) => {
  const fabRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 }); // Relative to bottom-right corner
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false); // To differentiate click from drag

  const storageKey = `nexus-fab-position-${window.location.hostname}`;

  // Load initial position from localStorage or set default
  useEffect(() => {
    const savedPosition = localStorage.getItem(storageKey);
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        // Basic validation
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
           setPosition(parsed);
           logger.info('[FAB Component] Loaded position from localStorage:', parsed);
        } else {
            throw new Error("Invalid position format");
        }
      } catch (e) {
         logger.warn('[FAB Component] Failed to parse saved position, using default.', e);
         setPosition({ x: 32, y: 32 }); // Default: 32px from bottom-right
         localStorage.removeItem(storageKey); // Clear invalid data
      }
    } else {
      setPosition({ x: 32, y: 32 }); // Default: 32px from bottom-right
      logger.info('[FAB Component] No saved position found, using default.');
    }
  }, [storageKey]);

  // Save position to localStorage whenever it changes
  useEffect(() => {
    // Don't save during drag, only when dragging stops (handled in onPointerUp)
    // This effect primarily handles the initial load setting the default if needed.
  }, [position, storageKey]);


  const handlePointerDown = useCallback((e) => {
    // Prevent text selection and default drag behaviors
    e.preventDefault();
    // Ignore right-clicks or middle-clicks
    if (e.button !== 0) return;

    setIsDragging(true);
    setHasMoved(false); // Reset movement flag
    // Record starting pointer position relative to the viewport
    setDragStart({ x: e.clientX, y: e.clientY });
    // Add listeners directly to the window to capture movement outside the button
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    logger.info('[FAB Component] Pointer Down - Drag Start');
  }, []);

  const handlePointerMove = useCallback((e) => {
    e.preventDefault(); // Prevent scrolling on touch devices

    // Calculate the distance moved from the start position
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // Check if the pointer has moved significantly to consider it a drag
    if (!hasMoved && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        setHasMoved(true);
    }

    // Calculate new position relative to bottom-right
    // Note: We are moving the button, so the change in pointer position (delta)
    // translates directly to a change in the offset from the corner.
    // A positive deltaX (mouse moved right) means the button should be further from the right edge (increase position.x)
    // A positive deltaY (mouse moved down) means the button should be further from the bottom edge (increase position.y)
    let newX = position.x - deltaX;
    let newY = position.y - deltaY;

    // --- Boundary Collision Detection ---
    const fabElement = fabRef.current;
    if (fabElement) {
        const rect = fabElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Prevent moving too far left (negative x offset means moving off right edge)
        if (newX < 0) newX = 0;
        // Prevent moving too far right (button's left edge goes past viewport left)
        if (viewportWidth - newX - rect.width < 0) newX = viewportWidth - rect.width;

        // Prevent moving too far up (negative y offset means moving off bottom edge)
        if (newY < 0) newY = 0;
        // Prevent moving too far down (button's top edge goes past viewport top)
        if (viewportHeight - newY - rect.height < 0) newY = viewportHeight - rect.height;
    }
    // --- End Boundary Collision ---


    // Update the position state *during* drag for visual feedback
    // This intermediate state is NOT saved to localStorage yet.
    setPosition({ x: newX, y: newY });

    // Update dragStart for the next move event (relative movement)
    setDragStart({ x: e.clientX, y: e.clientY });

  }, [dragStart, position, hasMoved]);


  const handlePointerUp = useCallback((e) => {
    // Ignore right-clicks or middle-clicks if they somehow trigger this
    if (e.button !== 0 && e.pointerType !== 'touch') return; // Allow touch release

    setIsDragging(false);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);

    // Save the final position after dragging stops
    // Use a stable reference to position inside setTimeout to get the latest state
    setTimeout(() => {
        setPosition(currentPos => {
            try {
                localStorage.setItem(storageKey, JSON.stringify(currentPos));
                logger.info('[FAB Component] Saved final position to localStorage:', currentPos);
            } catch (err) {
                logger.error('[FAB Component] Error saving position to localStorage:', err);
            }
            return currentPos; // No state change needed here
        });
    }, 0);


    logger.info('[FAB Component] Pointer Up - Drag End');

    // If it wasn't considered a drag (minimal movement), trigger the click
    if (!hasMoved && onClick) {
        logger.info('[FAB Component] Detected as click, calling onClick prop.');
        onClick();
    } else {
        logger.info('[FAB Component] Detected as drag release, not calling onClick.');
    }
    // Reset hasMoved for the next interaction
    setHasMoved(false);

  }, [onClick, handlePointerMove, storageKey, hasMoved]); // Include hasMoved dependency

  // Cleanup listeners on component unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);


  // Determine dynamic styles based on state
  const fabStyle = {
    // Position is relative to the container which is bottom-right
    // So, set bottom and right offsets based on state
    bottom: `${position.y}px`,
    right: `${position.x}px`,
    touchAction: 'none', // Prevent default touch actions like scrolling during drag
  };

  const fabClassName = `nexus-fab ${!isVisible ? 'hidden' : ''} ${isDragging ? 'dragging' : ''}`;

  return (
    <button
      ref={fabRef}
      id="nexus-ai-fab-button"
      className={fabClassName}
      style={fabStyle}
      onPointerDown={handlePointerDown}
      aria-label="Toggle AI Assistant Sidebar"
      title="Toggle AI Assistant Sidebar"
    >
      <SidebarIcon />
    </button>
  );
};

export default FloatingActionButton;
