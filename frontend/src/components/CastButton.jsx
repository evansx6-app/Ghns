import React from 'react';
import { Cast } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';

const CastButton = ({ 
  isCastAvailable, 
  isCasting, 
  onStartCasting, 
  onStopCasting,
  carMode = false 
}) => {
  const { toast } = useToast();

  const handleCastClick = () => {
    if (isCasting) {
      onStopCasting();
      toast({
        title: "Disconnected",
        description: "Stopped casting to TV",
      });
    } else {
      onStartCasting();
      toast({
        title: "Connecting...",
        description: "Connecting to your TV",
      });
    }
  };

  if (!isCastAvailable) {
    return null; // Don't show button if no cast devices available
  }

  return (
    <Button
      variant="outline"
      size={carMode ? "lg" : "sm"}
      onClick={handleCastClick}
      className={`
        ${isCasting 
          ? 'bg-blue-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30' 
          : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
        } 
        transition-all duration-300 touch-manipulation
        ${!carMode ? 'text-xs px-3 py-1.5' : ''}
      `}
    >
      {isCasting ? (
        <>
          <Cast className={`${carMode ? 'h-6 w-6 mr-3' : 'h-3.5 w-3.5 mr-1.5'} animate-pulse`} />
          <span className={carMode ? 'text-lg' : ''}>Casting</span>
        </>
      ) : (
        <>
          <Cast className={`${carMode ? 'h-6 w-6 mr-3' : 'h-3.5 w-3.5 mr-1.5'}`} />
          <span className={carMode ? 'text-lg' : ''}>Cast to TV</span>
        </>
      )}
    </Button>
  );
};

export default CastButton;