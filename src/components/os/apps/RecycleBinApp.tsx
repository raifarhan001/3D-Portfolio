'use client';

import { useState } from 'react';
import { OS_CONFIG } from '@/config/osConfig';
import { useOsStore } from '@/stores/osStore';
import { openAppById } from '@/utils/osActions';
import XpExplorerShell, { type ExplorerTaskGroup } from '@/components/os/XpExplorerShell';
import { RecycleItemIcon } from '@/components/os/xpIcons';

export default function RecycleBinApp() {
  const recycleBinEmptied = useOsStore((s) => s.recycleBinEmptied);
  const emptyRecycleBin = useOsStore((s) => s.emptyRecycleBin);
  const openDialog = useOsStore((s) => s.openDialog);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = recycleBinEmptied ? [] : OS_CONFIG.recycleBinFiles;

  const handleEmpty = () => {
    if (recycleBinEmptied) return;
    openDialog({
      kind: 'confirm',
      title: 'Confirm Multiple File Delete',
      message: `Are you sure you want to permanently delete all ${items.length} items from the Recycle Bin?`,
      okLabel: 'Yes',
      cancelLabel: 'No',
      onConfirm: emptyRecycleBin,
    });
  };

  const handleOpenItem = (id: string, name: string) => {
    const joke = OS_CONFIG.jokes[id] ?? OS_CONFIG.jokes[name] ?? OS_CONFIG.jokes.default;
    openDialog({
      kind: 'error',
      title: name,
      message: joke,
    });
  };

  const taskGroups: ExplorerTaskGroup[] = [
    {
      id: 'bin-tasks',
      title: 'Recycle Bin Tasks',
      items: [
        {
          label: 'Empty the Recycle Bin',
          onClick: handleEmpty,
          disabled: recycleBinEmptied,
        },
      ],
    },
    {
      id: 'bin-places',
      title: 'Other Places',
      items: [
        { label: 'My Computer', onClick: () => openAppById('my-computer') },
        { label: 'About Me', onClick: () => openAppById('about-me') },
      ],
    },
    {
      id: 'bin-details',
      title: 'Details',
      body: (
        <div className="text-[12px] text-[#111827] leading-snug">
          <div className="font-bold">Recycle Bin</div>
          <div>{items.length === 0 ? 'Empty' : `${items.length} discarded files`}</div>
        </div>
      ),
    },
  ];

  return (
    <XpExplorerShell
      addressPath="Recycle Bin"
      statusText={`${items.length} object(s)`}
      taskGroups={taskGroups}
    >
      {items.length === 0 ? (
        <div className="py-10 text-center text-[12px] text-[#4b5563]">
          The Recycle Bin is empty.
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-12 px-2 py-1 border-b border-[#d4d0c8] bg-[#f8fafc] text-[12px] font-semibold text-[#374151]">
            <span className="col-span-6">Name</span>
            <span className="col-span-3">Type</span>
            <span className="col-span-3 text-right">Size</span>
          </div>
          <div className="divide-y divide-[#f1f5f9]">
            {items.map((file) => {
              const isSelected = selectedId === file.id;
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setSelectedId(file.id)}
                  onDoubleClick={() => handleOpenItem(file.id, file.name)}
                  className={`w-full grid grid-cols-12 items-center px-2 py-1.5 text-left text-[12px] ${
                    isSelected ? 'bg-[#316ac5] text-white' : 'hover:bg-[#eef4ff] text-[#111827]'
                  }`}
                >
                  <span className="col-span-6 flex items-center gap-2 min-w-0">
                    <RecycleItemIcon kind={file.kind} size={20} />
                    <span className="truncate font-medium">{file.name}</span>
                  </span>
                  <span
                    className={`col-span-3 truncate ${
                      isSelected ? 'text-blue-100' : 'text-[#4b5563]'
                    }`}
                  >
                    {file.type}
                  </span>
                  <span
                    className={`col-span-3 text-right ${
                      isSelected ? 'text-blue-100' : 'text-[#4b5563]'
                    }`}
                  >
                    {file.size}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-[#6b7280]">
            Double-click any file to inspect its contents.
          </p>
        </div>
      )}
    </XpExplorerShell>
  );
}
