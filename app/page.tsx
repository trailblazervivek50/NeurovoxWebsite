'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Scan,
  ShoppingBag,
  History,
  Package,
  User,
  CheckCircle2,
  X,
  ArrowRight,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  AlertCircle,
  Truck,
  ExternalLink,
} from 'lucide-react';
import { MaskSize, MaskStyle, MASK_STYLES } from '@/lib/mask-fit';
import { FaceScanner } from '@/components/face-scanner';
import { StoreView } from '@/components/store-view';
import { getGuestScans, getSavedUsername, saveUsername } from '@/lib/storage';

type ActiveTab = 'home' | 'scanner' | 'store' | 'history' | 'orders';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderItem: {
    mask: MaskStyle;
    selectedSize: MaskSize;
    selectedColor: string;
    quantity: number;
  } | null;
  onOrderSuccess: (order: any) => void;
}

function CheckoutModal({ isOpen, onClose, orderItem, onOrderSuccess }: CheckoutModalProps) {
  const [customerName, setCustomerName] = useState(getSavedUsername() || 'Aditya Sharma');
  const [customerEmail, setCustomerEmail] = useState('aditya.sharma@example.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [addressLine, setAddressLine] = useState('Flat 402, Green Glen Heights, Bellandur');
  const [city, setCity] = useState('Bengaluru');
  const [stateName, setStateName] = useState('Karnataka');
  const [pincode, setPincode] = useState('560103');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !orderItem) return null;

  const itemTotal = orderItem.mask.priceInr * orderItem.quantity;
  const taxInr = Math.round(itemTotal * 0.18);
  const totalAmount = itemTotal + taxInr;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        userId: 'guest',
        customerName,
        customerEmail,
        shippingAddress: {
          line1: addressLine,
          city,
          state: stateName,
          pincode,
          phone,
          country: 'India',
        },
        items: [
          {
            maskId: orderItem.mask.id,
            name: orderItem.mask.name,
            size: orderItem.selectedSize,
            color: orderItem.selectedColor,
            quantity: orderItem.quantity,
            priceInr: orderItem.mask.priceInr,
          },
        ],
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        saveUsername(customerName);
        onOrderSuccess(data.order || data.processedDetails);
      } else {
        setErrorMsg(data.message || 'Unable to place order. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error processing checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#F5F2EA] text-[#2E3019] rounded-2xl shadow-2xl border border-[#DCD6C8] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#EAE5D8] border-b border-[#DCD6C8]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#4E5B31] text-white">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2E3019]">Express Checkout</h2>
              <p className="text-xs text-[#5D6346]">Dispatch from Mumbai fulfillment hub</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#5D6346] hover:text-[#2E3019] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handlePlaceOrder} className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Item Summary Card */}
          <div className="p-4 rounded-xl bg-white border border-[#DCD6C8] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#7C8264]">Configured Mask</span>
              <h4 className="text-base font-black text-[#2E3019]">{orderItem.mask.name}</h4>
              <div className="flex items-center gap-2 text-xs text-[#5D6346]">
                <span className="px-2 py-0.5 rounded bg-[#F5F2EA] font-semibold border border-[#DCD6C8]">
                  Size {orderItem.selectedSize}
                </span>
                <span>•</span>
                <span>{orderItem.selectedColor}</span>
                <span>•</span>
                <span>Qty: {orderItem.quantity}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-black text-[#2E3019]">
                ₹{itemTotal.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-emerald-800 font-semibold">Free Express Courier</div>
            </div>
          </div>

          {/* Shipping Form */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7C8264]">
              Delivery Destination & Recipient
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#5D6346] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DCD6C8] bg-white focus:outline-none focus:ring-2 focus:ring-[#4E5B31]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5D6346] mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DCD6C8] bg-white focus:outline-none focus:ring-2 focus:ring-[#4E5B31]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5D6346] mb-1">Street / Building Address</label>
              <input
                type="text"
                required
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DCD6C8] bg-white focus:outline-none focus:ring-2 focus:ring-[#4E5B31]"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#5D6346] mb-1">City</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DCD6C8] bg-white focus:outline-none focus:ring-2 focus:ring-[#4E5B31]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5D6346] mb-1">State</label>
                <input
                  type="text"
                  required
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DCD6C8] bg-white focus:outline-none focus:ring-2 focus:ring-[#4E5B31]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5D6346] mb-1">PIN Code</label>
                <input
                  type="text"
                  required
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DCD6C8] bg-white focus:outline-none focus:ring-2 focus:ring-[#4E5B31]"
                />
              </div>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="p-4 rounded-xl bg-[#EAE5D8] border border-[#DCD6C8] space-y-1.5 text-xs">
            <div className="flex justify-between text-[#5D6346]">
              <span>Product Subtotal</span>
              <span>₹{itemTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-[#5D6346]">
              <span>Integrated GST (18%)</span>
              <span>₹{taxInr.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-[#5D6346]">
              <span>Shipping & Packaging</span>
              <span className="text-emerald-800 font-bold">FREE</span>
            </div>
            <div className="flex justify-between text-sm font-black text-[#2E3019] pt-2 border-t border-[#DCD6C8]">
              <span>Total Payable</span>
              <span>₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#5D6346] hover:text-[#2E3019]"
            >
              Back to Catalog
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#4E5B31] hover:bg-[#3E4924] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Confirming Order...' : `Pay ₹${totalAmount.toLocaleString('en-IN')} & Dispatch`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [recommendedSize, setRecommendedSize] = useState<MaskSize | null>(null);
  const [recentScanResult, setRecentScanResult] = useState<any>(null);

  // Scans & Orders
  const [scansList, setScansList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Checkout modal
  const [checkoutItem, setCheckoutItem] = useState<{
    mask: MaskStyle;
    selectedSize: MaskSize;
    selectedColor: string;
    quantity: number;
  } | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Order Confirmed Notification
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  // Load scans and orders
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      // Local scans first
      const localScans = getGuestScans();
      // Fetch server scans
      const resScans = await fetch('/api/scans?userId=guest');
      if (resScans.ok) {
        const data = await resScans.json();
        if (data.scans && data.scans.length > 0) {
          setScansList(data.scans);
        } else {
          setScansList(localScans);
        }
      } else {
        setScansList(localScans);
      }

      // Fetch orders
      const resOrders = await fetch('/api/orders?userId=guest');
      if (resOrders.ok) {
        const data = await resOrders.json();
        if (data.orders) setOrdersList(data.orders);
      }
    } catch (e) {
      console.warn('History fetch note:', e);
      setScansList(getGuestScans());
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleScanComplete = (result: any) => {
    setRecentScanResult(result);
    setRecommendedSize(result.prediction.predictedSize);
    loadHistory();
  };

  const handleNavigateToStore = (size: MaskSize) => {
    setRecommendedSize(size);
    setActiveTab('store');
  };

  const handleProceedToCheckout = (item: any) => {
    setCheckoutItem(item);
    setIsCheckoutOpen(true);
  };

  const handleOrderSuccess = (order: any) => {
    setIsCheckoutOpen(false);
    setConfirmedOrder(order);
    loadHistory();
    setActiveTab('orders');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#F5F2EA]/95 backdrop-blur-md border-b border-[#DCD6C8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Mark */}
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-[#384323] text-white flex items-center justify-center shadow-xs">
              <Scan className="w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tight text-[#2E3019]">
              Neurovox AI
            </span>
          </div>

          {/* Navigation */}
          {activeTab === 'home' ? (
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setActiveTab('store')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#2E3019] hover:bg-[#EAE5D8] transition-colors"
              >
                <ShoppingBag className="w-4 h-4 text-[#4E5B31]" />
                <span>Store</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('history');
                  loadHistory();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#2E3019] hover:bg-[#EAE5D8] transition-colors"
              >
                <Clock className="w-4 h-4 text-[#4E5B31]" />
                <span>History</span>
              </button>

              <button
                onClick={() => window.open(window.location.href, '_blank')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5D6346] hover:text-[#2E3019] hover:bg-[#EAE5D8] transition-colors"
                title="Open in new tab"
              >
                <span>Open in Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <nav className="flex items-center gap-1 bg-[#EAE5D8] p-1 rounded-xl border border-[#DCD6C8]">
                <button
                  onClick={() => setActiveTab('home')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#5D6346] hover:text-[#2E3019] transition-all"
                >
                  <span>Home</span>
                </button>

                <button
                  onClick={() => setActiveTab('scanner')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'scanner'
                      ? 'bg-white text-[#2E3019] shadow-xs'
                      : 'text-[#5D6346] hover:text-[#2E3019]'
                  }`}
                >
                  <Scan className="w-3.5 h-3.5 text-[#4E5B31]" />
                  <span>Face Scanner</span>
                </button>

                <button
                  onClick={() => setActiveTab('store')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
                    activeTab === 'store'
                      ? 'bg-white text-[#2E3019] shadow-xs'
                      : 'text-[#5D6346] hover:text-[#2E3019]'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[#4E5B31]" />
                  <span>Protective Masks</span>
                  {recommendedSize && (
                    <span className="w-2 h-2 rounded-full bg-[#4E5B31] animate-pulse" />
                  )}
                </button>

                <button
                  onClick={() => {
                    setActiveTab('history');
                    loadHistory();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'history'
                      ? 'bg-white text-[#2E3019] shadow-xs'
                      : 'text-[#5D6346] hover:text-[#2E3019]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-[#4E5B31]" />
                  <span>Scan Logs</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('orders');
                    loadHistory();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'orders'
                      ? 'bg-white text-[#2E3019] shadow-xs'
                      : 'text-[#5D6346] hover:text-[#2E3019]'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-[#4E5B31]" />
                  <span>Orders</span>
                  {ordersList.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#4E5B31] text-white font-bold">
                      {ordersList.length}
                    </span>
                  )}
                </button>
              </nav>

              <button
                onClick={() => window.open(window.location.href, '_blank')}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#5D6346] hover:text-[#2E3019] hover:bg-[#EAE5D8] transition-colors"
                title="Open in new tab"
              >
                <span>Open in Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full flex-grow">
        {/* Order Confirmed Toast Banner */}
        {confirmedOrder && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <div className="font-bold text-xs">
                  Order Confirmed: #{confirmedOrder.id || confirmedOrder.orderId}
                </div>
                <div className="text-[11px] text-emerald-800">
                  Custom protective mask package staged for dispatched courier tracking.
                </div>
              </div>
            </div>
            <button
              onClick={() => setConfirmedOrder(null)}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab 0: Home Hero View */}
        {activeTab === 'home' && (
          <div className="py-6 sm:py-10 md:py-14 flex flex-col items-center justify-center text-center animate-fade-in">
            {/* Sparkles Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EAE5D8] border border-[#DCD6C8] text-xs font-semibold text-[#4E5B31] shadow-2xs mb-6 sm:mb-8">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Next-Gen Face Scanning</span>
            </div>

            {/* Hero Headline */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-[#2E3019] tracking-tight leading-[1.08] text-center max-w-4xl mx-auto">
              Find Your Perfect<br />
              Mask Fit Instantly
            </h1>

            {/* Hero Subtitle */}
            <p className="text-base sm:text-lg text-[#5D6346] max-w-2xl mx-auto text-center leading-relaxed mt-5 mb-8 sm:mb-10">
              AI-powered face scan for accurate mask sizing. No measurements needed. Just look at the camera and let our technology do the rest.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3.5 mb-14 sm:mb-20">
              <button
                onClick={() => setActiveTab('scanner')}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#384323] hover:bg-[#2A3319] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Start Face Scan</span>
                <Scan className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActiveTab('store')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#EAE5D8] hover:bg-[#DCD6C8] text-[#2E3019] text-sm font-bold border border-[#DCD6C8] transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-[#4E5B31]" />
                <span>Access Store</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('history');
                  loadHistory();
                }}
                className="inline-flex items-center gap-2 px-4 py-3.5 text-[#5D6346] hover:text-[#2E3019] text-sm font-semibold transition-all cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>Scan History</span>
              </button>
            </div>

            {/* 3 Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full text-left">
              {/* Card 1: Real-time Tracking */}
              <div className="group p-7 rounded-2xl bg-white/80 border border-[#DCD6C8] shadow-2xs hover:shadow-xl hover:border-[#4E5B31]/40 hover:bg-white transition-all duration-300 transform hover:-translate-y-2 cursor-pointer">
                <div className="w-12 h-12 rounded-2xl bg-[#EAE5D8] flex items-center justify-center text-[#384323] mb-5 group-hover:bg-[#384323] group-hover:text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-xs">
                  <Scan className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#2E3019] mb-2 group-hover:text-[#384323] transition-colors duration-300">Real-time Tracking</h3>
                <p className="text-xs sm:text-sm text-[#5D6346] leading-relaxed">
                  Sub-millimeter facial landmark detection running 100% in-browser with zero latency.
                </p>
              </div>

              {/* Card 2: Instant Results */}
              <div className="group p-7 rounded-2xl bg-white/80 border border-[#DCD6C8] shadow-2xs hover:shadow-xl hover:border-[#4E5B31]/40 hover:bg-white transition-all duration-300 transform hover:-translate-y-2 cursor-pointer">
                <div className="w-12 h-12 rounded-2xl bg-[#EAE5D8] flex items-center justify-center text-[#384323] mb-5 group-hover:bg-[#384323] group-hover:text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-xs">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#2E3019] mb-2 group-hover:text-[#384323] transition-colors duration-300">Instant Results</h3>
                <p className="text-xs sm:text-sm text-[#5D6346] leading-relaxed">
                  Neural network classification matches your biometric profile to optimal mask sizes in milliseconds.
                </p>
              </div>

              {/* Card 3: Privacy First */}
              <div className="group p-7 rounded-2xl bg-white/80 border border-[#DCD6C8] shadow-2xs hover:shadow-xl hover:border-[#4E5B31]/40 hover:bg-white transition-all duration-300 transform hover:-translate-y-2 cursor-pointer">
                <div className="w-12 h-12 rounded-2xl bg-[#EAE5D8] flex items-center justify-center text-[#384323] mb-5 group-hover:bg-[#384323] group-hover:text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-xs">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#2E3019] mb-2 group-hover:text-[#384323] transition-colors duration-300">Privacy First</h3>
                <p className="text-xs sm:text-sm text-[#5D6346] leading-relaxed">
                  All facial analysis runs locally on your device. Video frames are never recorded or sent to servers.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Scanner View */}
        {activeTab === 'scanner' && (
          <FaceScanner
            onScanComplete={handleScanComplete}
            onNavigateToStore={handleNavigateToStore}
          />
        )}

        {/* Tab 2: Store Catalog View */}
        {activeTab === 'store' && (
          <StoreView
            recommendedSize={recommendedSize}
            onProceedToCheckout={handleProceedToCheckout}
          />
        )}

        {/* Tab 3: Scan Telemetry History */}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#DCD6C8]">
              <div>
                <h2 className="text-xl font-black text-[#2E3019]">Biometric Scan History</h2>
                <p className="text-xs text-[#5D6346] mt-0.5">
                  Multi-frame stability records with 30-day scheduled retention purge
                </p>
              </div>
              <button
                onClick={() => setActiveTab('scanner')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4E5B31] hover:bg-[#3E4924] text-white text-xs font-bold shadow-sm transition-colors"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>New Face Scan</span>
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-12 text-center text-xs text-[#7C8264]">Loading scan logs...</div>
            ) : scansList.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white/60 border border-[#DCD6C8] space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#EAE5D8] flex items-center justify-center text-[#5D6346]">
                  <Scan className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[#2E3019]">No Biometric Scans Logged</h3>
                <p className="text-xs text-[#5D6346] max-w-sm mx-auto">
                  Run a camera scan or launch the synthetic demo simulation to record calibrated anthropometric facial landmarks.
                </p>
                <button
                  onClick={() => setActiveTab('scanner')}
                  className="px-5 py-2 rounded-xl bg-[#4E5B31] text-white text-xs font-bold inline-flex items-center gap-1.5 mt-2"
                >
                  Launch Scanner
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {scansList.map((scan, idx) => (
                  <div
                    key={scan.id || idx}
                    className="p-5 rounded-2xl bg-white border border-[#DCD6C8] shadow-sm flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-[#2E3019]">
                          Size {scan.recommendedSize || 'Medium'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E3EBD7] text-[#294212] border border-[#C2D4AB]">
                          {Math.round((scan.confidence || 0.95) * 100)}% Confidence
                        </span>
                        {scan.isDemoSimulation && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                            Demo Simulation
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#5D6346]">
                        <span>Jaw: <strong>{scan.jawWidthCm} cm</strong></span>
                        <span>•</span>
                        <span>Height: <strong>{scan.faceHeightCm} cm</strong></span>
                        <span>•</span>
                        <span>Quality: <strong>{scan.scanQuality || 'High'}</strong></span>
                      </div>

                      <div className="text-[11px] text-[#7C8264] flex items-center gap-1 pt-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {scan.createdAt ? new Date(scan.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }) : 'Recent Scan'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleNavigateToStore(scan.recommendedSize || 'Medium')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EAE5D8] hover:bg-[#DCD6C8] text-[#2E3019] text-xs font-semibold transition-colors border border-[#C4BDB0]"
                    >
                      <span>Shop Size {scan.recommendedSize || 'Medium'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Placed Orders */}
        {activeTab === 'orders' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#DCD6C8]">
              <div>
                <h2 className="text-xl font-black text-[#2E3019]">Placed Protective Orders</h2>
                <p className="text-xs text-[#5D6346] mt-0.5">
                  Fulfillment tracking with verified protective mask sizing specifications
                </p>
              </div>
              <button
                onClick={() => setActiveTab('store')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4E5B31] hover:bg-[#3E4924] text-white text-xs font-bold shadow-sm transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Visit Store</span>
              </button>
            </div>

            {ordersList.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white/60 border border-[#DCD6C8] space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#EAE5D8] flex items-center justify-center text-[#5D6346]">
                  <Truck className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[#2E3019]">No Orders Placed Yet</h3>
                <p className="text-xs text-[#5D6346] max-w-sm mx-auto">
                  Browse fitted protective respirators in our catalog and place an order calibrated to your facial geometry.
                </p>
                <button
                  onClick={() => setActiveTab('store')}
                  className="px-5 py-2 rounded-xl bg-[#4E5B31] text-white text-xs font-bold inline-flex items-center gap-1.5 mt-2"
                >
                  Open Store Catalog
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {ordersList.map((order, idx) => (
                  <div
                    key={order.id || idx}
                    className="p-5 rounded-2xl bg-white border border-[#DCD6C8] shadow-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EAE5D8]">
                      <div>
                        <span className="text-[11px] font-bold text-[#7C8264]">ORDER #{order.id}</span>
                        <div className="text-xs text-[#5D6346]">
                          Placed on{' '}
                          {new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Status: Dispatched</span>
                        </span>
                        <span className="text-sm font-black text-[#2E3019]">
                          ₹{(order.totalInr || 1499).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {(order.items || []).map((item: any, iIdx: number) => (
                        <div key={iIdx} className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#2E3019]">{item.name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-[#F5F2EA] text-[10px] font-semibold border border-[#DCD6C8]">
                              Size {item.size}
                            </span>
                            <span className="text-[#7C8264]">({item.color})</span>
                          </div>
                          <div className="text-[#5D6346]">Qty {item.quantity || 1}</div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 text-[11px] text-[#7C8264] flex items-center justify-between">
                      <span>Delivery: {order.shippingAddress?.city || 'Bengaluru'}, {order.shippingAddress?.state || 'India'}</span>
                      <span className="font-medium text-[#4E5B31]">Courier Partner: BlueDart Air Express</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        orderItem={checkoutItem}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-[#DCD6C8] bg-[#EAE5D8]/60 text-xs text-[#5D6346]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-bold text-[#2E3019]">Neurovox Biometric Sizing Platform</span>
            <p className="text-[11px] text-[#7C8264] mt-0.5">
              Calibrated on 6.3 cm inter-ocular reference baseline • 30-day automated biometric retention purge
            </p>
          </div>

          <div className="text-[11px] text-[#7C8264] max-w-md text-right">
            AI-assisted anthropometric sizing advisory. For certified hazardous gas environments, verify with qualitative fit testing protocols.
          </div>
        </div>
      </footer>
    </div>
  );
}
