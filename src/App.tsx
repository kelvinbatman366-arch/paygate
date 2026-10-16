import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  PlayCircle,
  PlusCircle,
  FileText,
  History as HistoryIcon,
  Smartphone,
  Settings as SettingsIcon,
  Bell,
  Shuffle,
  Play,
  Pause,
  Square,
  Cpu,
  X,
  FileText as FileDetailText
} from 'lucide-react';

// ==========================================
// TYPES & DATA STRUCTURES
// ==========================================
export interface AppNotification {
  id: string;
  name: string;
  amount: number;
  currency: string;
  message: string;
  createdAt: string;
  status: 'Simulated';
  generatorId?: string;
}

export interface GeneratorConfig {
  id: string;
  status: 'Running' | 'Paused' | 'Stopped';
  duration: string;
  interval: string;
  randomInterval: boolean;
  minInterval: number;
  maxInterval: number;
  maxNotifications: string;
  randomName: boolean;
  randomAmount: boolean;
  randomMessage: boolean;
  minAmount: number;
  maxAmount: number;
  notificationsGenerated: number;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
}

export interface Settings {
  defaultCurrency: string;
  defaultMinAmount: number;
  defaultMaxAmount: number;
  browserNotifications: boolean;
  sound: boolean;
  vibration: boolean;
  appearance: 'Dark' | 'Light' | 'System';
}

const DEFAULT_NAMES = [
  'John Smith', 'Michael Johnson', 'David Williams', 'James Brown', 'Robert Davis',
  'Daniel Wilson', 'Chris Anderson', 'Matthew Taylor', 'Andrew Thomas', 'Joshua Moore',
  'Ryan Martin', 'Kevin Lee', 'Brian White', 'Jason Harris', 'Ethan Clark'
];

const DEFAULT_TEMPLATES: Template[] = [
  { id: '1', name: 'Standard Payment', content: 'Payment received from {name}', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), enabled: true },
  { id: '2', name: 'Dash Format', content: 'Payment received — {name}', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), enabled: true },
  { id: '3', name: 'Amount Explicit', content: 'Payment of {amount} {currency} received from {name}', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), enabled: true }
];

const DEFAULT_SETTINGS: Settings = {
  defaultCurrency: 'USD',
  defaultMinAmount: 20,
  defaultMaxAmount: 100,
  browserNotifications: true,
  sound: true,
  vibration: true,
  appearance: 'Dark'
};

const StorageService = {
  get: <T,>(key: string, fallback: T): T => {
    try {
      const data = localStorage.getItem(`paygate_${key}`);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(`paygate_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage failed:', e);
    }
  }
};

const playNotificationSound = (enabled: boolean) => {
  if (!enabled) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
};

// ==========================================
// MAIN PAYGATE APPLICATION
// ==========================================
export default function PaygateApp() {
  const [tab, setTab] = useState('dashboard');
  const [settings, setSettings] = useState<Settings>(() => StorageService.get('settings', DEFAULT_SETTINGS));
  const [templates, setTemplates] = useState<Template[]>(() => StorageService.get('templates', DEFAULT_TEMPLATES));
  const [history, setHistory] = useState<AppNotification[]>(() => StorageService.get('history', []));
  const [names, setNames] = useState<string[]>(() => StorageService.get('names', DEFAULT_NAMES));
  const [toast, setToast] = useState<string | null>(null);
  const [latest, setLatest] = useState<AppNotification | null>(null);

  const [activeGen, setActiveGen] = useState<GeneratorConfig | null>(null);
  const [genCount, setGenCount] = useState(0);
  const [nextIn, setNextIn] = useState<number | null>(null);
  const timeoutRef = useRef<any>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const generateNotification = useCallback((override?: { name?: string; amount?: number; message?: string }, genId?: string) => {
    const activeTpls = templates.filter(t => t.enabled);
    const selectedTpl = activeTpls.length > 0 ? activeTpls[Math.floor(Math.random() * activeTpls.length)] : { content: 'Payment received from {name}' };

    const name = override?.name || names[Math.floor(Math.random() * names