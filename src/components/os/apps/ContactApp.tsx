'use client';

import { useState } from 'react';
import { OS_CONFIG } from '@/config/osConfig';
import { useOsStore } from '@/stores/osStore';
import { MailIcon } from '@/components/os/xpIcons';

export default function ContactApp() {
  const openDialog = useOsStore((s) => s.openDialog);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sentNotice, setSentNotice] = useState(false);

  const handleSend = () => {
    if (message.trim().length === 0) {
      openDialog({
        kind: 'error',
        title: 'Outlook Express',
        message: 'Your message body is empty. Please enter a message before sending.',
      });
      return;
    }

    const params = new URLSearchParams();
    if (subject.trim()) params.set('subject', subject.trim());
    params.set('body', message);
    const mailtoUrl = `mailto:${OS_CONFIG.contact.email}?${params.toString()}`;
    window.open(mailtoUrl, '_blank', 'noopener,noreferrer');
    setSentNotice(true);
  };

  const links = [
    { label: 'GitHub Profile', href: OS_CONFIG.contact.github, hint: 'RaiFarhan0' },
    { label: 'LinkedIn', href: OS_CONFIG.contact.linkedin, hint: 'rai-farhan' },
    { label: 'Fiverr', href: OS_CONFIG.contact.fiverr, hint: 'rai_farhan' },
    {
      label: 'Email Direct',
      href: `mailto:${OS_CONFIG.contact.email}`,
      hint: OS_CONFIG.contact.email,
    },
  ];

  return (
    <div
      className="flex-1 min-h-0 flex flex-col bg-[#ece9d8]"
      style={{ fontFamily: OS_CONFIG.fonts.ui, fontSize: 12 }}
    >
      {/* Outlook Express Menu + Send Toolbar */}
      <div className="h-[22px] px-2 flex items-center gap-3 border-b border-[#d4d0c8] text-[#111827] shrink-0">
        {['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Message', 'Help'].map((m) => (
          <span key={m} className="px-1 py-0.5 rounded-xs hover:bg-[#316ac5] hover:text-white cursor-default">
            {m}
          </span>
        ))}
      </div>

      <div className="h-[34px] px-2 flex items-center gap-2 border-b border-[#aca899] bg-[#ece9d8] shrink-0">
        <button
          type="button"
          onClick={handleSend}
          className="px-3 py-1 flex items-center gap-1.5 rounded-[3px] border border-[#003c74] bg-gradient-to-b from-[#ffffff] to-[#d9d6c8] text-[#111827] font-semibold text-[12px] hover:brightness-105 active:translate-y-[1px]"
        >
          <MailIcon size={16} />
          <span>Send</span>
        </button>
        {sentNotice && (
          <span className="text-[12px] text-[#166534] font-medium">
            Mail client opened with draft ready.
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Left Task Pane with Direct Contact Links */}
        <aside
          className="w-[186px] shrink-0 p-2 flex flex-col gap-2"
          style={{
            background: `linear-gradient(180deg, ${OS_CONFIG.colors.taskPaneBgTop} 0%, ${OS_CONFIG.colors.taskPaneBgBottom} 100%)`,
          }}
        >
          <div className="rounded-t-[4px] overflow-hidden border border-white/40">
            <div
              style={{
                background: `linear-gradient(90deg, ${OS_CONFIG.colors.taskHeaderBgStart} 0%, ${OS_CONFIG.colors.taskHeaderBgEnd} 100%)`,
              }}
              className="px-2.5 py-1 text-[12px] font-bold text-[#215dc6]"
            >
              Connect Online
            </div>
            <div
              className="p-2 flex flex-col gap-2 text-[12px]"
              style={{ backgroundColor: OS_CONFIG.colors.taskCardBg }}
            >
              {links.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-[3px] px-1.5 py-1 hover:bg-white/60 text-[#215dc6]"
                >
                  <div className="font-semibold underline">{item.label}</div>
                  <div className="text-[12px] text-[#334155] truncate">{item.hint}</div>
                </a>
              ))}
            </div>
          </div>
        </aside>

        {/* Compose Form */}
        <div className="flex-1 min-w-0 flex flex-col p-3 gap-2 bg-[#f5f3ec]">
          <div className="flex items-center gap-2">
            <label htmlFor="contact-to" className="w-[58px] text-right font-semibold text-[#374151] shrink-0">
              To:
            </label>
            <input
              id="contact-to"
              type="text"
              readOnly
              value={OS_CONFIG.contact.email}
              className="flex-1 h-[24px] px-2 bg-[#f3f4f6] border border-[#7f9db9] text-[12px] text-[#111827] rounded-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="contact-subject" className="w-[58px] text-right font-semibold text-[#374151] shrink-0">
              Subject:
            </label>
            <input
              id="contact-subject"
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setSentNotice(false);
              }}
              placeholder="Project inquiry / Collaboration"
              className="flex-1 h-[24px] px-2 bg-white border border-[#7f9db9] text-[12px] text-[#111827] rounded-xs focus:outline-none focus:border-[#0058e6]"
            />
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <label htmlFor="contact-message" className="sr-only">
              Message
            </label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setSentNotice(false);
              }}
              placeholder="Write your message here..."
              className="flex-1 w-full min-h-[140px] p-2.5 bg-white border border-[#7f9db9] text-[12px] text-[#111827] rounded-xs resize-none focus:outline-none focus:border-[#0058e6]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
