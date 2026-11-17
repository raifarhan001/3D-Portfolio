'use client';

import { OS_CONFIG } from '@/config/osConfig';
import { getProjectById } from '@/utils/githubProjects';
import { useOsStore } from '@/stores/osStore';

export async function openResumeAction(): Promise<void> {
  const store = useOsStore.getState();
  store.setStartMenuOpen(false);
  store.setContextMenu(null);

  try {
    const res = await fetch(OS_CONFIG.resumeUrl, { method: 'HEAD' });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || ct.includes('text/html')) {
      store.openDialog({
        kind: 'error',
        title: 'Resume.pdf',
        message: 'Resume.pdf could not be found.',
      });
      return;
    }
  } catch {
    store.openDialog({
      kind: 'error',
      title: 'Resume.pdf',
      message: 'Resume.pdf could not be found.',
    });
    return;
  }

  store.openWindow({
    id: 'resume',
    kind: 'resume',
    title: 'Rai_Farhan_CV.pdf',
    width: 760,
    height: 440,
  });
}

export function openAppById(id: string): void {
  const store = useOsStore.getState();
  if (id === 'my-computer') {
    store.openWindow({ id: 'my-computer', kind: 'my-computer', title: 'My Computer', width: 720, height: 420 });
  } else if (id === 'recycle-bin') {
    store.openWindow({ id: 'recycle-bin', kind: 'recycle-bin', title: 'Recycle Bin', width: 680, height: 390 });
  } else if (id === 'about-me') {
    store.openWindow({ id: 'about-me', kind: 'about-me', title: 'PROFILE.TXT - Notepad', width: 640, height: 410 });
  } else if (id === 'guestbook') {
    store.openWindow({ id: 'guestbook', kind: 'guestbook', title: 'Studio Guestbook — Rai XP', width: 680, height: 410 });
  } else if (id === 'contact') {
    store.openWindow({ id: 'contact', kind: 'contact', title: 'New Message - Outlook Express', width: 680, height: 410 });
  } else if (id === 'resume') {
    void openResumeAction();
  } else if (id.startsWith('project:')) {
    const projectId = id.slice('project:'.length);
    const project = getProjectById(projectId);
    if (project) {
      store.openWindow({
        id,
        kind: 'project',
        title: project.name,
        projectId: project.id,
        width: 840,
        height: 430,
      });
    }
  }
}
