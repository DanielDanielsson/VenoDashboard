'use client';
/* eslint-disable @next/next/no-img-element */

import type { ImgHTMLAttributes, SyntheticEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { getBunnyImage } from '@/utils/getBunnyImage';

type BunnyImageFormat = 'webp' | 'avif' | 'jpg' | 'png';

interface BunnyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  format?: BunnyImageFormat;
  imageName: string;
  onError?: (event: SyntheticEvent<HTMLImageElement, Event>) => void;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  twStyles?: string;
  width?: number;
}

const calculateOptimalWidth = (renderedWidth: number, devicePixelRatio = 1) => {
  const targetWidth = renderedWidth * devicePixelRatio;

  return Math.ceil(targetWidth / 100) * 100;
};

const debounce = <T extends (...args: unknown[]) => void>(
  callback: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => callback(...args), wait);
  };
};

export const BunnyImage = ({
  alt,
  className,
  format = 'webp',
  imageName,
  onError,
  priority = false,
  quality = 90,
  sizes,
  twStyles,
  width = 1200,
  ...rest
}: BunnyImageProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);

  const optimalWidth = (() => {
    if (sizes && measuredWidth !== null) {
      return calculateOptimalWidth(measuredWidth, devicePixelRatio);
    }

    return calculateOptimalWidth(width, devicePixelRatio);
  })();

  const imageUrl = getBunnyImage(imageName, optimalWidth, quality, format);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setDevicePixelRatio(window.devicePixelRatio || 1);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (!sizes || !containerRef.current) {
      return;
    }

    const measureWidth = () => {
      requestAnimationFrame(() => {
        const container = containerRef.current;

        if (!container) {
          return;
        }

        const renderedWidth = container.getBoundingClientRect().width;

        if (renderedWidth > 0) {
          setMeasuredWidth((previousWidth) => {
            if (previousWidth === null || Math.abs(previousWidth - renderedWidth) > 10) {
              return renderedWidth;
            }

            return previousWidth;
          });
        }
      });
    };

    const debouncedMeasureWidth = debounce(measureWidth, 150);

    measureWidth();

    resizeObserverRef.current = new ResizeObserver(() => {
      measureWidth();
    });

    resizeObserverRef.current.observe(containerRef.current);
    window.addEventListener('resize', debouncedMeasureWidth, { passive: true });

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      window.removeEventListener('resize', debouncedMeasureWidth);
    };
  }, [sizes]);

  const imageElement = (
    <img
      alt={alt}
      className={twMerge(className, twStyles)}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      loading={priority ? 'eager' : 'lazy'}
      onError={onError}
      src={imageUrl}
      width={optimalWidth || width}
      {...rest}
    />
  );

  if (!sizes) {
    return imageElement;
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      {imageElement}
    </div>
  );
};
