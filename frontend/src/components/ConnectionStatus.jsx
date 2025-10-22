import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';
import { connectionManager, streamAPI } from '../services/api';

const ConnectionStatus = ({ onReconnect }) => {
  const [connectionState, setConnectionState] = useState({
    online: navigator.onLine,
    apiConnected: true,
    reconnecting: false,
    lastConnected: null
  });
  const { toast } = useToast();

  useEffect(() => {
    // Initial connection check
    checkConnectionStatus();

    // Listen for connection changes
    const handleConnectionChange = (status, isOnline) => {
      setConnectionState(prev => ({
        ...prev,
        online: isOnline,
        lastConnected: isOnline ? new Date() : prev.lastConnected
      }));

      // Show appropriate notifications
      if (status === 'online') {
        toast({
          title: "🌐 Connection Restored",
          description: "You're back online. Refreshing data...",
        });
        
        // Trigger reconnection logic
        if (onReconnect) {
          onReconnect();
        }
      } else if (status === 'offline') {
        toast({
          title: "📡 Connection Lost", 
          description: "Working offline with cached data",
          variant: "destructive",
        });
      }
    };

    connectionManager.addConnectionListener(handleConnectionChange);

    // Periodic API connectivity checks
    const apiCheckInterval = setInterval(checkApiConnection, 60000); // Every minute

    return () => {
      connectionManager.removeConnectionListener(handleConnectionChange);
      clearInterval(apiCheckInterval);
    };
  }, [onReconnect, toast]);

  const checkConnectionStatus = async () => {
    try {
      const result = await streamAPI.checkConnection();
      setConnectionState(prev => ({
        ...prev,
        apiConnected: result.connected,
        online: result.online
      }));
    } catch (error) {
      setConnectionState(prev => ({
        ...prev,
        apiConnected: false
      }));
    }
  };

  const checkApiConnection = async () => {
    if (!connectionState.online) return;
    
    try {
      const result = await streamAPI.checkConnection();
      setConnectionState(prev => ({
        ...prev,
        apiConnected: result.connected
      }));
    } catch (error) {
      setConnectionState(prev => ({
        ...prev,
        apiConnected: false
      }));
    }
  };

  const handleManualReconnect = async () => {
    setConnectionState(prev => ({ ...prev, reconnecting: true }));
    
    try {
      await checkConnectionStatus();
      
      if (onReconnect) {
        await onReconnect();
      }
      
      toast({
        title: "🔄 Reconnection Successful",
        description: "Connection restored and data refreshed",
      });
    } catch (error) {
      toast({
        title: "❌ Reconnection Failed",
        description: "Please check your internet connection",
        variant: "destructive",
      });
    } finally {
      setConnectionState(prev => ({ ...prev, reconnecting: false }));
    }
  };

  // Don't show status if everything is connected
  if (connectionState.online && connectionState.apiConnected) {
    return null;
  }

  const getStatusIcon = () => {
    if (connectionState.reconnecting) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />;
    }
    
    if (!connectionState.online) {
      return <WifiOff className="h-4 w-4 text-red-400" />;
    }
    
    if (!connectionState.apiConnected) {
      return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    }
    
    return <Wifi className="h-4 w-4 text-green-400" />;
  };

  const getStatusText = () => {
    if (connectionState.reconnecting) {
      return 'Reconnecting...';
    }
    
    if (!connectionState.online) {
      return 'Offline';
    }
    
    if (!connectionState.apiConnected) {
      return 'API Connection Issue';
    }
    
    return 'Connected';
  };

  const getStatusColor = () => {
    if (connectionState.reconnecting) return 'border-blue-400/50 bg-blue-400/10';
    if (!connectionState.online) return 'border-red-400/50 bg-red-400/10';
    if (!connectionState.apiConnected) return 'border-yellow-400/50 bg-yellow-400/10';
    return 'border-green-400/50 bg-green-400/10';
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border backdrop-blur-sm transition-all duration-300 ${getStatusColor()}`}>
        {getStatusIcon()}
        
        <div className="text-sm">
          <div className="font-medium text-white">{getStatusText()}</div>
          {!connectionState.online && (
            <div className="text-xs text-white/70">Check your internet connection</div>
          )}
          {connectionState.online && !connectionState.apiConnected && (
            <div className="text-xs text-white/70">Server connection issues</div>
          )}
        </div>

        {!connectionState.online || !connectionState.apiConnected ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleManualReconnect}
            disabled={connectionState.reconnecting}
            className="h-8 px-2 text-white/80 hover:text-white hover:bg-white/10"
          >
            {connectionState.reconnecting ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              'Retry'
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default ConnectionStatus;