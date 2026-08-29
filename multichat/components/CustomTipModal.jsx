import React, { useState } from 'react';
import { X, Tv, Sparkles, IndianRupee, DollarSign, Euro, PoundSterling } from 'lucide-react';
import PlatformLogo from './PlatformLogo';
import { colorForManualAmount, getDurationForAmount } from './HighlightOverlay';

const PRESET_AMOUNTS = [20, 40, 100, 500, 1000, 2000];

export default function CustomTipModal({ 
  msg, 
  onClose, 
  onConfirm 
}) {
  const [currency, setCurrency] = useState('₹');
  const [amount, setAmount] = useState('100');
  const [customText, setCustomText] = useState(msg?.text || '');
  const [durationMode, setDurationMode] = useState('tier'); // 'tier' | 'custom'
  const [customSeconds, setCustomSeconds] = useState(15);

  if (!msg) return null;

  const numericAmount = parseFloat(amount) || 0;
  const tierColor = colorForManualAmount(numericAmount);
  const tierDurationSec = getDurationForAmount(numericAmount) || 600;

  const handlePresetClick = (val) => {
    setAmount(String(val));
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) return;

    onConfirm({
      overrideAmount: `${currency}${Math.floor(numericAmount)}`,
      overrideMessage: customText,
      autoHideSeconds: durationMode === 'tier' ? tierDurationSec : customSeconds
    });
  };

  return (
    <div 
      className="custom-tip-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div 
        className="custom-tip-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#12131a',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(2, 132, 199, 0.15)',
          overflow: 'hidden',
          animation: 'modalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {/* Header */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.12), rgba(0, 0, 0, 0))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.2)', color: '#38bdf8' }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                Feature with Custom Tip
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Display as a Super Chat overlay on live stream
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSend} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Target Chatter Info Card */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}
          >
            {msg.avatarUrl ? (
              <img 
                src={msg.avatarUrl} 
                alt={msg.displayName} 
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} 
              />
            ) : (
              <div 
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px'
                }}
              >
                {msg.displayName?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#f1f5f9' }}>{msg.displayName}</span>
                <PlatformLogo platform={msg.platform} isShorts={msg.isShorts} size={13} />
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>@{msg.username || 'viewer'}</span>
            </div>
            {numericAmount > 0 && (
              <div 
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontWeight: 800,
                  fontSize: '13px',
                  backgroundColor: tierColor ? tierColor.bg : '#BF953F',
                  color: tierColor ? tierColor.text : '#4d3400'
                }}
              >
                {currency}{Math.floor(numericAmount)}
              </div>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
              Quick Preset Amount
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
              {PRESET_AMOUNTS.map((amt) => {
                const isSelected = String(amt) === String(amount);
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handlePresetClick(amt)}
                    style={{
                      padding: '8px 0',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                      backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#38bdf8' : '#e2e8f0',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {currency}{amt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Amount & Currency Input */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
              Donation Amount & Currency
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {['₹', '$', '€', '£'].map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrency(curr)}
                    style={{
                      width: '36px',
                      height: '38px',
                      borderRadius: '6px',
                      border: currency === curr ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: currency === curr ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      color: currency === curr ? '#38bdf8' : '#cbd5e1',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {curr}
                  </button>
                ))}
              </div>
              <input 
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                style={{
                  flex: 1,
                  height: '38px',
                  backgroundColor: '#090a0f',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  padding: '0 12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  outline: 'none'
                }}
                required
              />
            </div>
          </div>

          {/* Message Text */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
              Featured Message Text
            </label>
            <textarea 
              rows={2}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Message to display on overlay..."
              style={{
                width: '100%',
                backgroundColor: '#090a0f',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#ffffff',
                padding: '10px 12px',
                fontSize: '13px',
                resize: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Duration Options */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
                Overlay Display Duration
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setDurationMode('tier')}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: durationMode === 'tier' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: durationMode === 'tier' ? 'rgba(56,189,248,0.2)' : 'transparent',
                    color: durationMode === 'tier' ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Amount Tier ({Math.floor(tierDurationSec / 60)} min)
                </button>
                <button
                  type="button"
                  onClick={() => setDurationMode('custom')}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: durationMode === 'custom' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: durationMode === 'custom' ? 'rgba(56,189,248,0.2)' : 'transparent',
                    color: durationMode === 'custom' ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Custom ({customSeconds}s)
                </button>
              </div>
            </div>

            {durationMode === 'custom' && (
              <input 
                type="range"
                min="5"
                max="120"
                step="1"
                value={customSeconds}
                onChange={(e) => setCustomSeconds(parseInt(e.target.value, 10))}
                style={{ width: '100%' }}
              />
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 2,
                padding: '10px 0',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(90deg, #0284c7, #0369a1)',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
              }}
            >
              <Tv size={16} />
              <span>Feature on Stream ({currency}{Math.floor(numericAmount)})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
