import React, { useState, useRef, useCallback } from 'react';

const RotaryDial = ({ 
  value = 0, 
  min = -12, 
  max = 12, 
  step = 0.5, 
  onChange, 
  disabled = false, 
  color = '#B87333', 
  size = 60, 
  label = '' 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, value: 0 });
  const dialRef = useRef(null);

  // Convert value to rotation angle (-150° to +150°)
  const valueToAngle = (val) => {
    const range = max - min;
    const normalizedValue = (val - min) / range;
    return (normalizedValue * 300) - 150; // 300° total range, centered at 0
  };

  // Convert angle to value
  const angleToValue = (angle) => {
    const normalizedAngle = (angle + 150) / 300; // Convert to 0-1 range
    return min + (normalizedAngle * (max - min));
  };

  const handleMouseDown = useCallback((e) => {
    if (disabled) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      value: value
    });
  }, [disabled, value]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || disabled) return;
    
    e.preventDefault();
    
    // Calculate delta movement (vertical movement controls the knob)
    const deltaY = dragStart.y - e.clientY; // Negative y = increase value
    const sensitivity = 0.5; // Adjust sensitivity
    const valueChange = deltaY * sensitivity * step;
    
    const newValue = Math.max(min, Math.min(max, dragStart.value + valueChange));
    
    // Round to nearest step
    const steppedValue = Math.round(newValue / step) * step;
    
    if (onChange) {
      onChange([steppedValue]);
    }
  }, [isDragging, dragStart, min, max, step, onChange, disabled]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch event handlers
  const handleTouchStart = useCallback((e) => {
    if (disabled) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX,
      y: touch.clientY,
      value: value
    });
  }, [disabled, value]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || disabled) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    
    const deltaY = dragStart.y - touch.clientY;
    const sensitivity = 0.5;
    const valueChange = deltaY * sensitivity * step;
    
    const newValue = Math.max(min, Math.min(max, dragStart.value + valueChange));
    const steppedValue = Math.round(newValue / step) * step;
    
    if (onChange) {
      onChange([steppedValue]);
    }
  }, [isDragging, dragStart, min, max, step, onChange, disabled]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const angle = valueToAngle(value);
  
  return (
    <div className="flex flex-col items-center space-y-2">
      {/* Rotary Dial */}
      <div 
        ref={dialRef}
        className={`relative cursor-pointer select-none touch-manipulation ${disabled ? 'opacity-50' : ''}`}
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Outer Ring */}
        <div 
          className="absolute inset-0 rounded-full border-2 bg-gradient-to-b from-gray-700 to-gray-800 shadow-lg"
          style={{ 
            borderColor: color,
            boxShadow: `0 0 10px ${color}20, inset 0 2px 4px rgba(0,0,0,0.3)`
          }}
        />
        
        {/* Inner Dial */}
        <div 
          className="absolute inset-1 rounded-full bg-gradient-to-b from-gray-600 to-gray-700 shadow-inner flex items-center justify-center"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {/* Dial Indicator */}
          <div 
            className="absolute w-1 rounded-full bg-white shadow-md"
            style={{ 
              height: size * 0.3,
              top: size * 0.05,
              backgroundColor: color
            }}
          />
          
          {/* Center Dot */}
          <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
        </div>
        
        {/* Tick Marks */}
        <div className="absolute inset-0">
          {[-12, -6, 0, 6, 12].map((tickValue) => {
            const tickAngle = valueToAngle(tickValue);
            const isZero = tickValue === 0;
            
            return (
              <div
                key={tickValue}
                className="absolute w-0.5 bg-white/30"
                style={{
                  height: isZero ? size * 0.08 : size * 0.06,
                  left: '50%',
                  top: size * 0.02,
                  transformOrigin: '50% ' + (size * 0.48) + 'px',
                  transform: `translateX(-50%) rotate(${tickAngle}deg)`,
                  backgroundColor: isZero ? color : 'rgba(255,255,255,0.3)'
                }}
              />
            );
          })}
        </div>
      </div>
      
      {/* Value Display */}
      <div className="text-center">
        <div className="text-white/50 text-xs font-medium mb-1">{label}</div>
        <div 
          className="text-white font-mono text-sm px-2 py-1 rounded bg-black/30 min-w-12"
          style={{ color: color }}
        >
          {value > 0 ? '+' : ''}{value.toFixed(1)}
        </div>
      </div>
    </div>
  );
};

export default RotaryDial;