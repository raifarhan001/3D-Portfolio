import type { DetectedGpuTier } from '@/stores/loadingStore';
import type { GraphicsQuality } from '@/config/roomContent';

export interface ClientRenderCapabilities {
  webglSupported: boolean;
  isMobile: boolean;
  gpuTier: DetectedGpuTier;
  recommendedQuality: GraphicsQuality;
  canEnter3D: boolean;
}

export function detectMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const narrowViewport = window.innerWidth < 768;
  const isCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return mobileUa || narrowViewport || (isCoarsePointer && window.innerWidth < 1024);
}

export function detectClientRenderCapabilities(): ClientRenderCapabilities {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      webglSupported: true,
      isMobile: false,
      gpuTier: 'high',
      recommendedQuality: 'high',
      canEnter3D: true,
    };
  }

  const isMobile = detectMobileDevice();

  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  const canvas = document.createElement('canvas');
  try {
    gl =
      (canvas.getContext('webgl2', { powerPreference: 'high-performance' }) as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
  } catch {
    gl = null;
  }

  if (!gl) {
    return {
      webglSupported: false,
      isMobile,
      gpuTier: 'unsupported',
      recommendedQuality: 'high',
      canEnter3D: false,
    };
  }

  let rendererStr = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      rendererStr = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    }
  } catch {
    // ignore debug extension restriction
  }

  const maxTexSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096);
  const loseExt = gl.getExtension('WEBGL_lose_context');
  loseExt?.loseContext();

  if (maxTexSize < 2048) {
    return {
      webglSupported: true,
      isMobile,
      gpuTier: 'unsupported',
      recommendedQuality: 'high',
      canEnter3D: false,
    };
  }

  const lowIndicators = /swiftshader|llvmpipe|software|mali-4|adreno 3|intel\(r\) hd graphics/i;
  const isLowTier = lowIndicators.test(rendererStr) || maxTexSize < 4096;
  const gpuTier: DetectedGpuTier = isLowTier ? 'low' : 'high';

  return {
    webglSupported: true,
    isMobile,
    gpuTier,
    recommendedQuality: 'high',
    canEnter3D: !isMobile,
  };
}
