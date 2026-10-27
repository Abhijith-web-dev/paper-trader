import React, { useState } from 'react';
import { X, Lock, Unlock, Download, Upload, ShieldCheck, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import { db } from '../lib/localDb';
import { encryptVault, decryptVault, downloadFile } from '../lib/vaultCrypto';

export default function DataVaultModal({ isOpen, onClose }) {
  const [passphrase, setPassphrase] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  // Export encrypted backup
  const handleExportEncryptedVault = async (e) => {
    e.preventDefault();
    if (!passphrase) {
      setErrorMessage('Please enter a passphrase to encrypt your vault.');
      return;
    }
    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      // Gather all local IndexedDB records
      const watchlists = await db.watchlists.toArray();
      const journal = await db.journal.toArray();
      const alerts = await db.alerts.toArray();
      const strategies = await db.strategies.toArray();

      const vaultData = {
        exportedAt: new Date().toISOString(),
        tables: {
          watchlists,
          journal,
          alerts,
          strategies,
        },
      };

      const encryptedPackage = await encryptVault(vaultData, passphrase);
      downloadFile(
        encryptedPackage,
        `trader_vault_${new Date().toISOString().slice(0, 10)}.vault.json`,
        'application/json'
      );
      setStatusMessage('Vault successfully encrypted and exported!');
      setPassphrase('');
    } catch (err) {
      setErrorMessage(err.message || 'Encryption failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Restore encrypted backup
  const handleFileRestore = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!restorePassphrase) {
      setErrorMessage('Please enter the decryption passphrase before selecting the backup file.');
      event.target.value = '';
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const fileText = await file.text();
      const decrypted = await decryptVault(fileText, restorePassphrase);

      if (!decrypted.tables) {
        throw new Error('Unrecognized vault structure.');
      }

      // Restore into Dexie
      if (decrypted.tables.journal?.length > 0) {
        await db.journal.clear();
        await db.journal.bulkAdd(decrypted.tables.journal);
      }
      if (decrypted.tables.watchlists?.length > 0) {
        await db.watchlists.clear();
        await db.watchlists.bulkAdd(decrypted.tables.watchlists);
      }
      if (decrypted.tables.alerts?.length > 0) {
        await db.alerts.clear();
        await db.alerts.bulkAdd(decrypted.tables.alerts);
      }
      if (decrypted.tables.strategies?.length > 0) {
        await db.strategies.clear();
        await db.strategies.bulkAdd(decrypted.tables.strategies);
      }

      setStatusMessage(
        `Successfully restored vault! Loaded ${decrypted.tables.journal?.length || 0} journal records and ${
          decrypted.tables.watchlists?.length || 0
        } watchlist items.`
      );
      setRestorePassphrase('');
    } catch (err) {
      setErrorMessage(err.message || 'Restoration failed. Invalid passphrase or file corrupted.');
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#F6F4EE] border-2 border-[#111111] shadow-[8px_8px_0px_#111111] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[#111111] bg-[#111111] text-[#F6F4EE]">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h3 className="font-serif font-bold text-base uppercase tracking-wider">
              Encrypted Local Data Vault (Web Crypto AES-GCM)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 transition-colors text-neutral-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs font-mono">
          <p className="text-neutral-600 font-sans leading-relaxed">
            Protect your sensitive trading records, journal notes, and custom strategies on your own device. Backups are encrypted with military-grade <strong>AES-GCM-256</strong> using your personal passphrase via the native browser <strong>Web Crypto API</strong>.
          </p>

          {statusMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Export Section */}
          <div className="p-4 bg-white border border-[#111111] space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-[#111111]">
              <Download className="w-4 h-4 text-neutral-700" />
              <span>Export Encrypted Vault Backup</span>
            </div>
            <form onSubmit={handleExportEncryptedVault} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase text-neutral-500 font-bold mb-1">
                  Choose Encryption Passphrase
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Master passphrase for AES-256 key derivation"
                  className="w-full border border-[#111111] px-3 py-1.5 bg-neutral-50"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isProcessing || !passphrase}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#111111] text-[#F6F4EE] font-bold hover:bg-neutral-800 disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Encrypt & Download (.vault.json)</span>
              </button>
            </form>
          </div>

          {/* Restore Section */}
          <div className="p-4 bg-white border border-[#111111] space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-[#111111]">
              <Upload className="w-4 h-4 text-neutral-700" />
              <span>Restore from Encrypted Vault</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase text-neutral-500 font-bold mb-1">
                  Decryption Passphrase
                </label>
                <input
                  type="password"
                  value={restorePassphrase}
                  onChange={(e) => setRestorePassphrase(e.target.value)}
                  placeholder="Enter original passphrase"
                  className="w-full border border-[#111111] px-3 py-1.5 bg-neutral-50"
                />
              </div>
              <label className="block">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileRestore}
                  disabled={!restorePassphrase || isProcessing}
                  className="block w-full text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:border file:border-[#111111] file:text-xs file:font-mono file:font-bold file:bg-[#111111] file:text-white hover:file:bg-neutral-800 cursor-pointer disabled:opacity-50"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-neutral-300 bg-neutral-100 flex items-center justify-between text-xs font-mono text-neutral-500">
          <span>Zero Server Upload • Pure In-Browser SubtleCrypto</span>
          <button onClick={onClose} className="hover:underline font-bold text-[#111111]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
