import { useState, useEffect, useRef } from 'react';

export const useColorExtraction = (imageUrl, fallbackColors = {
  primary: 'rgb(245, 158, 11)',
  secondary: 'rgb(251, 146, 60)', 
  accent: 'rgb(217, 119, 6)',
  tertiary: 'rgb(194, 65, 12)',
  quaternary: 'rgb(154, 52, 18)'
}) => {
  const [colors, setColors] = useState(fallbackColors);
  const [isExtracting, setIsExtracting] = useState(false);
  const canvasRef = useRef(null);

  const extractColors = (imageSrc) => {
    return new Promise((resolve) => {
      if (!imageSrc || imageSrc.includes('placeholder')) {
        resolve(fallbackColors);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Set canvas size for analysis
          const size = 150; // Larger sample for better color extraction
          canvas.width = size;
          canvas.height = size;
          
          // Draw and analyze image
          ctx.drawImage(img, 0, 0, size, size);
          const imageData = ctx.getImageData(0, 0, size, size);
          
          // Extract dominant colors
          const colors = getDominantColors(imageData.data);
          resolve(colors);
        } catch (error) {
          console.error('Color extraction error:', error);
          resolve(fallbackColors);
        }
      };
      
      img.onerror = () => {
        resolve(fallbackColors);
      };
      
      img.src = imageSrc;
    });
  };

  const getDominantColors = (imageData) => {
    const pixels = [];
    
    // Sample pixels more densely for better color extraction
    for (let i = 0; i < imageData.length; i += 8) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const a = imageData[i + 3];
      
      // Skip transparent pixels and pure black/white
      if (a < 100 || (r + g + b) < 30 || (r + g + b) > 720) continue;
      
      // Boost saturation for more vibrant colors
      const [h, s, l] = rgbToHsl(r, g, b);
      if (s < 0.2) continue; // Skip low saturation colors
      
      pixels.push([r, g, b]);
    }
    
    if (pixels.length === 0) return fallbackColors;
    
    // Use K-means clustering to find dominant colors
    const clusters = kMeansColors(pixels, 5); // Get more colors
    
    // Enhance the colors for better UI impact
    const enhancedColors = clusters.map(color => enhanceColor(color));
    
    return {
      primary: `rgb(${enhancedColors[0].join(',')})`,
      secondary: `rgb(${enhancedColors[1].join(',')})`,
      accent: `rgb(${enhancedColors[2].join(',')})`,
      tertiary: `rgb(${enhancedColors[3].join(',')})`,
      quaternary: `rgb(${enhancedColors[4].join(',')})`
    };
  };

  const rgbToHsl = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return [h * 360, s, l];
  };

  const enhanceColor = (color) => {
    // Boost saturation and adjust brightness for better UI visibility
    const [r, g, b] = color;
    const [h, s, l] = rgbToHsl(r, g, b);
    
    // Enhance saturation and adjust lightness
    const newS = Math.min(1, s * 1.4); // Boost saturation
    const newL = Math.max(0.3, Math.min(0.8, l)); // Keep in usable range
    
    return hslToRgb(h, newS, newL);
  };

  const hslToRgb = (h, s, l) => {
    h /= 360;
    
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const kMeansColors = (pixels, k) => {
    // Simplified K-means for color clustering
    let centroids = [];
    
    // Initialize centroids randomly
    for (let i = 0; i < k; i++) {
      const randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
      centroids.push([...randomPixel]);
    }
    
    // Iterate to find stable clusters
    for (let iter = 0; iter < 15; iter++) {
      const clusters = Array(k).fill().map(() => []);
      
      // Assign pixels to nearest centroid
      pixels.forEach(pixel => {
        let minDist = Infinity;
        let closestCentroid = 0;
        
        centroids.forEach((centroid, idx) => {
          const dist = Math.sqrt(
            Math.pow(pixel[0] - centroid[0], 2) +
            Math.pow(pixel[1] - centroid[1], 2) +
            Math.pow(pixel[2] - centroid[2], 2)
          );
          
          if (dist < minDist) {
            minDist = dist;
            closestCentroid = idx;
          }
        });
        
        clusters[closestCentroid].push(pixel);
      });
      
      // Update centroids
      centroids = clusters.map(cluster => {
        if (cluster.length === 0) return centroids[0]; // Fallback
        
        const avgR = Math.round(cluster.reduce((sum, p) => sum + p[0], 0) / cluster.length);
        const avgG = Math.round(cluster.reduce((sum, p) => sum + p[1], 0) / cluster.length);
        const avgB = Math.round(cluster.reduce((sum, p) => sum + p[2], 0) / cluster.length);
        
        return [avgR, avgG, avgB];
      });
    }
    
    // Sort by brightness for consistent ordering
    return centroids.sort((a, b) => {
      const brightnessA = a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114;
      const brightnessB = b[0] * 0.299 + b[1] * 0.587 + b[2] * 0.114;
      return brightnessB - brightnessA;
    });
  };

  useEffect(() => {
    if (imageUrl) {
      setIsExtracting(true);
      extractColors(imageUrl).then((extractedColors) => {
        setColors(extractedColors);
        setIsExtracting(false);
      });
    }
  }, [imageUrl]);

  return { colors, isExtracting };
};