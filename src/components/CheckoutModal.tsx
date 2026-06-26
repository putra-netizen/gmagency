/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Language, Order } from '../types';
import { TRANSLATIONS } from '../lib/translations';
import { dbCreateOrder } from '../lib/supabase';
import { formatRupiah } from './ProductCard';
import { X, Check, HelpCircle, Phone, Link2, FileText, ShoppingBag, ArrowRight, MessageSquare, AlertCircle } from 'lucide-react';
import { getQrisConfig } from '../utils/qrisHelper';

interface CheckoutModalProps {
  product: Product;
  currentLang: Language;
  onClose: () => void;
  onSuccess: (order: Order) => void;
}

export default function CheckoutModal({ product, currentLang, onClose, onSuccess }: CheckoutModalProps) {
  const t = TRANSLATIONS[currentLang];
  const qrisConfig = getQrisConfig();

  // Form states
  const [buyerName, setBuyerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [quantity, setQuantity] = useState(10); // Standard starting quantity
  const [notes, setNotes] = useState('');
  const [targetLink, setTargetLink] = useState('');
  const [targetSpamPhone, setTargetSpamPhone] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Auto-calculate prices
  const totalPrice = product.price * quantity;

  // Handle Order Submit
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !phoneNumber.trim()) {
      setErrorMsg(currentLang === 'id' ? 'Nama lengkap dan nomor WhatsApp wajib diisi.' : 'Full name and WhatsApp number are required.');
      return;
    }

    if (quantity < 1) {
      setErrorMsg(currentLang === 'id' ? 'Jumlah pesanan minimal 1.' : 'Minimum order quantity is 1.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const orderPayload: Partial<Order> = {
        product_id: product.id,
        buyer_name: buyerName,
        phone_number: phoneNumber,
        notes: notes,
        target_link: targetLink,
        target_spam_phone: targetSpamPhone,
        quantity: quantity,
        total_price: totalPrice
      };

      const result = await dbCreateOrder(orderPayload);
      setCreatedOrder(result);
      onSuccess(result);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(currentLang === 'id' ? 'Gagal menyimpan pesanan. Silakan coba lagi.' : 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate dynamic WhatsApp link for the invoice confirmation
  const getSuccessWhatsAppLink = (order: Order) => {
    const defaultNumber = '6285921095666';
    const message = currentLang === 'id'
      ? `*KONFIRMASI PEMBAYARAN - GM AGENCY*\n\nHalo GM Agency,\nSaya ingin melakukan konfirmasi pembayaran untuk pesanan digital berikut:\n\n• *ID Invoice:* ${order.id}\n• *Nama Pemesan:* ${order.buyer_name}\n• *Layanan:* ${order.product_name}\n• *Jumlah:* ${order.quantity} pcs\n• *Total Tagihan:* ${formatRupiah(order.total_price)}\n• *Nomor Pelanggan:* ${order.phone_number}\n${order.target_link ? `• *Link Target:* ${order.target_link}\n` : ''}${order.target_spam_phone ? `• *Nomor WA Target:* ${order.target_spam_phone}\n` : ''}${order.notes ? `• *Catatan:* ${order.notes}\n` : ''}\nSaya melampirkan bukti transfer pembayaran QRIS di atas. Mohon segera diproses layanan kami. Terima kasih!`
      : `*PAYMENT CONFIRMATION - GM AGENCY*\n\nHello GM Agency,\nI would like to confirm my payment for the following digital order:\n\n• *Invoice ID:* ${order.id}\n• *Customer Name:* ${order.buyer_name}\n• *Service:* ${order.product_name}\n• *Quantity:* ${order.quantity} pcs\n• *Total Amount:* ${formatRupiah(order.total_price)}\n• *Customer Phone:* ${order.phone_number}\n${order.target_link ? `• *Target URL:* ${order.target_link}\n` : ''}${order.target_spam_phone ? `• *Target WA/Phone:* ${order.target_spam_phone}\n` : ''}${order.notes ? `• *Notes:* ${order.notes}\n` : ''}\nI am attaching my QRIS payment receipt. Please proceed with our order. Thank you!`;

    return `https://wa.me/${defaultNumber}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-all border border-slate-100 flex flex-col my-8"
        id="checkout-modal-container"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-950 font-sans tracking-tight">
              {createdOrder ? t.orderSuccessTitle : t.checkoutTitle}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            id="close-checkout-modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Main Body (Left: Form, Right: Invoice QRIS card) */}
        {!createdOrder ? (
          <form onSubmit={handleCheckoutSubmit} className="grid grid-cols-1 md:grid-cols-12 overflow-y-auto max-h-[80vh]">
            {/* Left side: Input Form fields (7 columns) */}
            <div className="p-6 md:col-span-7 space-y-4 border-r border-slate-100">
              
              {/* Product Info Display */}
              <div className="rounded-xl bg-blue-50/50 border border-blue-100/50 p-4 flex items-center gap-4">
                <img 
                  src={product.image_url} 
                  alt={product.name} 
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-sans leading-tight">
                    {currentLang === 'id' ? product.name : product.name_en}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {formatRupiah(product.price)} / pcs
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-semibold text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Form Input fields */}
              <div className="space-y-3">
                {/* Full Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                    {t.fullName} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder={t.fullNamePl}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* WhatsApp Number */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                    {t.phoneWa} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder={t.phoneWaPl}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Quantity Input with click support */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                      {t.quantity} <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden p-0.5">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 5))}
                        className="px-2.5 py-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 font-bold text-xs transition-colors"
                      >
                        -5
                      </button>
                      <input
                        type="number"
                        min="1"
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-center text-xs font-bold text-slate-800 bg-transparent outline-none border-0"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(quantity + 5)}
                        className="px-2.5 py-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 font-bold text-xs transition-colors"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  {/* Pricing Overview inside Form */}
                  <div className="flex flex-col justify-end bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Subtotal Tagihan</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5">
                      {formatRupiah(totalPrice)}
                    </span>
                  </div>
                </div>

                {/* Target Link (Critical for Reviews & Social Media Services) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {t.targetLink}
                    </label>
                    <span className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                      Untuk Review / Sosmed
                    </span>
                  </div>
                  <div className="relative">
                    <Link2 className="absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="url"
                      value={targetLink}
                      onChange={(e) => setTargetLink(e.target.value)}
                      placeholder={t.targetLinkPl}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Target WhatsApp/Phone Number for specific services (e.g., spam report warning or testing) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {t.targetSpamPhone}
                    </label>
                    <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                      WA Target
                    </span>
                  </div>
                  <div className="relative">
                    <Phone className="absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="tel"
                      value={targetSpamPhone}
                      onChange={(e) => setTargetSpamPhone(e.target.value)}
                      placeholder={t.targetSpamPhonePl}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                    {t.notes}
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t.notesPl}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs h-16 outline-none resize-none focus:ring-1 focus:ring-blue-600 transition-all"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                id="submit-order-checkout"
              >
                {isSubmitting ? t.processing : t.btnSubmitCheckout}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Right side: Dynamic QRIS Invoice Generator Card (5 columns) */}
            <div className="p-6 md:col-span-5 bg-slate-50 flex flex-col justify-between border-t md:border-t-0 border-slate-100 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-900 font-sans uppercase tracking-wider">
                    {t.qrisTitle}
                  </h3>
                  <span className="rounded bg-pink-100 px-2 py-0.5 text-[10px] font-extrabold text-pink-700 border border-pink-200">
                    QRIS GPN
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t.qrisScan}
                </p>

                {/* Professional QRIS Vector Generator Box */}
                <div className="mx-auto max-w-[240px] rounded-2xl border border-slate-200 bg-white p-3 shadow-md flex flex-col items-center">
                  <img
                    src={qrisConfig.imageUrl}
                    alt="QRIS Pembayaran GMSOLUTION"
                    className="w-full h-auto rounded-lg object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="mt-2 flex items-center justify-center gap-1 border-t border-slate-100 pt-2 w-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    <span className="text-[9px] font-extrabold text-emerald-700">LIVE QRIS MERCHANT</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Layanan</span>
                    <span className="text-slate-800 font-bold max-w-[160px] truncate">
                      {currentLang === 'id' ? product.name : product.name_en}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Jumlah Unit</span>
                    <span className="text-slate-800 font-bold">{quantity} pcs</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium border-t border-slate-100 pt-2">
                    <span className="text-slate-800 font-bold">{t.amountToPay}</span>
                    <span className="text-base font-extrabold text-blue-600 font-sans">
                      {formatRupiah(totalPrice)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Secure guarantee text */}
              <div className="text-[10px] text-slate-400 text-center leading-normal">
                Transaksi dilindungi oleh enkripsi SSL GM Agency. Invoice resmi diterbitkan setelah penekanan tombol submit.
              </div>
            </div>
          </form>
        ) : (
          /* SUCCESS INVOICE STATE with WhatsApp confirmation button */
          <div className="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto bg-slate-50/50">
            
            {/* Visual Success Indicator banner */}
            <div className="text-center space-y-3 max-w-xl mx-auto">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm border border-emerald-200">
                <Check className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-950 font-sans tracking-tight">
                {t.orderSuccessTitle}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-sans">
                {t.orderSuccessDesc}
              </p>
            </div>

            {/* Invoice card content detail layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-3xl mx-auto">
              {/* Left Column: Registered Data */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detail Invoice</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600 border border-blue-100">
                    {createdOrder.id}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nama Pelanggan</span>
                    <span className="font-semibold text-slate-900">{createdOrder.buyer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">WhatsApp / Telepon</span>
                    <span className="font-semibold text-slate-900">{createdOrder.phone_number}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-50 pt-2">
                    <span className="text-slate-500">Layanan Dipilih</span>
                    <span className="font-bold text-slate-900 max-w-[180px] truncate">{createdOrder.product_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jumlah Order</span>
                    <span className="font-bold text-slate-900">{createdOrder.quantity} pcs</span>
                  </div>
                  
                  {/* Conditionally render target details */}
                  {createdOrder.target_link && (
                    <div className="border-t border-slate-50 pt-2 space-y-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Link Target</span>
                      <a href={createdOrder.target_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block truncate">
                        {createdOrder.target_link}
                      </a>
                    </div>
                  )}

                  {createdOrder.target_spam_phone && (
                    <div className="border-t border-slate-50 pt-2 flex justify-between">
                      <span className="text-slate-500">No. WA Target</span>
                      <span className="font-bold text-amber-700">{createdOrder.target_spam_phone}</span>
                    </div>
                  )}

                  {createdOrder.notes && (
                    <div className="border-t border-slate-50 pt-2 space-y-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Catatan Anda</span>
                      <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                        "{createdOrder.notes}"
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-slate-100 pt-3">
                    <span className="font-bold text-slate-900">Total Nominal</span>
                    <span className="font-extrabold text-blue-600 text-base">{formatRupiah(createdOrder.total_price)}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: QRIS scanning box for transfer */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col items-center">
                <span className="text-xs font-extrabold text-pink-600 uppercase tracking-widest border-b border-slate-100 pb-2 w-full text-center">
                  PINDAI & TRANSFER QRIS
                </span>

                <div className="bg-white rounded-xl p-2 border border-slate-100 max-w-[200px]">
                  <img
                    src={qrisConfig.imageUrl}
                    alt="QRIS Pembayaran GMSOLUTION"
                    className="w-full h-auto rounded-lg object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Merchant</span>
                  <span className="text-sm font-extrabold text-slate-900 block">{qrisConfig.merchantName}</span>
                  <span className="text-xs font-bold text-blue-600 mt-1 block font-mono">
                    {formatRupiah(createdOrder.total_price)}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct WhatsApp Call to action */}
            <div className="flex flex-col items-center pt-4 max-w-xl mx-auto space-y-4">
              <a
                href={getSuccessWhatsAppLink(createdOrder)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-6 py-4 text-base font-extrabold text-white shadow-xl shadow-emerald-500/10 transition-all hover:bg-emerald-700 hover:shadow-emerald-500/20 active:scale-[0.98]"
                id="whatsapp-confirm-success"
              >
                <MessageSquare className="h-5 w-5 fill-white" />
                <span>{t.btnPaySuccess}</span>
              </a>

              <button
                onClick={onClose}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 hover:underline"
              >
                {t.backToHome}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
