import React, { useState, useRef, useEffect } from 'react';
import { X, Shirt, Upload, Sparkles, Image as ImageIcon, ArrowRight, RefreshCw, Download, Zap, Check, Copy } from 'lucide-react';
import { designShirtFromReference } from '../services/aiChat';
import { useToast } from '../context/ToastContext';

interface ShirtGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDesignGenerated: (imageUrl: string, designPrompt: string) => void;
}

const ShirtGeneratorModal: React.FC<ShirtGeneratorModalProps> = ({ isOpen, onClose, onDesignGenerated }) => {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'analyze' | 'generate' | 'result'>('upload');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [userInstructions, setUserInstructions] = useState('');
  const [designPrompt, setDesignPrompt] = useState('');
  const [generatedDesign, setGeneratedDesign] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('upload'); setReferenceImage(null); setUserInstructions('');
      setDesignPrompt(''); setGeneratedDesign(null); setError(null); setIsProcessing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); addToast('Image must be under 5MB', 'error'); return; }
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); addToast('Please select an image file', 'error'); return; }
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => setReferenceImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleStartDesign = async () => {
    if (!referenceImage) { setError('Please upload a reference image first'); return; }
    setError(null); setStep('analyze'); setIsProcessing(true);
    try {
      addToast('Analyzing your reference image...', 'success');
      const result = await designShirtFromReference(referenceImage, userInstructions);
      if (!result.success) throw new Error(result.error || 'Failed to generate design');
      setDesignPrompt(result.designPrompt || '');
      setGeneratedDesign(result.imageUrl || null);
      setStep('result');
      if (result.imageUrl) { addToast('Shirt design generated!', 'success'); }
      else { addToast('Design prompt created but image generation unavailable.', 'warning'); }
    } catch (err: any) {
      setError(err.message || 'Something went wrong.'); addToast('Design generation failed', 'error'); setStep('upload');
    } finally { setIsProcessing(false); }
  };

  const handleDownload = () => {
    if (!generatedDesign) return;
    const a = document.createElement('a'); a.href = generatedDesign;
    a.download = 'coalition-shirt-design-' + Date.now() + '.png'; a.click();
    addToast('Design downloaded!', 'success');
  };

  const handleRetry = () => { setStep('upload'); setDesignPrompt(''); setGeneratedDesign(null); setError(null); };
  const handleCopyPrompt = () => { navigator.clipboard.writeText(designPrompt); addToast('Prompt copied!', 'success'); };

  const steps = ['upload', 'analyze', 'generate', 'result'] as const;
  const stepIndex = steps.indexOf(step);
  const getStepClass = (s: typeof steps[number], i: number) => {
    if (step === s) return 'bg-orange-500 text-white scale-110 shadow-lg shadow-orange-500/20';
    if (stepIndex > i) return 'bg-green-500/20 text-green-400 border border-green-500/30';
    return 'bg-white/5 text-gray-600 border border-white/10';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 to-black shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center rotate-3">
              <Shirt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-white uppercase tracking-tight text-lg">Shirt Designer</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">AI-Powered Coalition Design Lab</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white" disabled={isProcessing}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-center gap-2">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className={'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black uppercase transition-all ' + getStepClass(s, i)}>
                  {stepIndex > i ? '\u2713' : i + 1}
                </div>
                {i < 3 && <div className={'w-8 h-px ' + (i < stepIndex ? 'bg-orange-500' : 'bg-white/10')} />}
              </React.Fragment>
            ))}
          </div>
          <p className="text-center text-[10px] text-gray-600 uppercase tracking-widest">Upload → Analyze → Design</p>
          {error && (<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3"><div className="w-2 h-2 bg-red-400 rounded-full animate-pulse shrink-0" /><p className="text-sm text-red-400">{error}</p></div>)}
          {step === 'upload' && (<div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">1. Upload Reference Image</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              {referenceImage ? (<div className="relative group rounded-xl overflow-hidden border border-gray-700 bg-black/30">
                <img src={referenceImage} alt="Reference" className="w-full h-64 object-contain" />
                <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"><RefreshCw className="w-5 h-5 text-white" /><span className="text-sm font-bold uppercase">Change Image</span></button>
                <div className="absolute top-3 left-3"><span className="bg-black/70 text-white text-[10px] font-bold uppercase px-2 py-1 rounded border border-white/10">Reference</span></div>
              </div>) : (<button onClick={() => fileInputRef.current?.click()} className="w-full aspect-video border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center gap-4 hover:border-orange-500 hover:bg-orange-500/5 transition-all group">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-orange-500/10 transition-all"><Upload className="w-8 h-8 text-gray-500 group-hover:text-orange-400 transition-colors" /></div>
                <div className="text-center"><p className="text-sm font-bold text-gray-400 group-hover:text-white transition-colors">Upload Reference Image</p><p className="text-xs text-gray-600 mt-1">A photo, sketch, or design to mix with Coalition style</p></div>
              </button>)}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">2. Your Vision (Optional)</label>
              <textarea value={userInstructions} onChange={(e) => setUserInstructions(e.target.value)} placeholder="e.g. Add the crowned bird emblem... Make it minimal... Use a tie-dye base..." className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-sm text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none transition resize-none h-24" />
              <p className="text-[10px] text-gray-600 mt-1 ml-1">Guide the AI on how to transform your reference into a Coalition design</p>
            </div>
            <button onClick={handleStartDesign} disabled={!referenceImage} className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-black uppercase py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20 disabled:opacity-40 disabled:cursor-not-allowed"><Sparkles className="w-5 h-5" />Start Designing<ArrowRight className="w-4 h-4" /></button>
          </div>)}
          {(step === 'analyze' || step === 'generate') && (<div className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="relative"><div className="w-20 h-20 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" /><div className="absolute inset-0 flex items-center justify-center">{step === 'analyze' ? <ImageIcon className="w-8 h-8 text-orange-400 animate-pulse" /> : <Shirt className="w-8 h-8 text-orange-400 animate-pulse" />}</div></div>
            <div className="text-center space-y-2"><p className="text-lg font-bold text-white">{step === 'analyze' ? 'Analyzing Reference...' : 'Generating Design...'}</p><p className="text-sm text-gray-500 max-w-sm">{step === 'analyze' ? 'AI is extracting the aesthetic DNA from your reference and fusing it with Coalition brand style.' : 'Transforming the concept into a premium streetwear shirt design.'}</p></div>
            {referenceImage && (<div className="w-24 h-24 rounded-lg overflow-hidden border border-gray-700 opacity-50"><img src={referenceImage} alt="Ref" className="w-full h-full object-cover" /></div>)}
          </div>)}
          {step === 'result' && (<div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">Your Coalition Shirt Design</label>
              <div className="relative group rounded-xl overflow-hidden border border-gray-700 bg-gradient-to-b from-gray-900 to-black">
                {generatedDesign ? (<><img src={generatedDesign} alt="Generated Shirt Design" className="w-full h-auto object-contain max-h-[400px]" /><div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4"><button onClick={handleDownload} className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition text-white" title="Download Design"><Download className="w-6 h-6" /></button></div><div className="absolute top-3 left-3"><span className="bg-orange-500 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5"><Zap className="w-3 h-3" />Coalition Design</span></div></>) : (<div className="flex flex-col items-center justify-center py-16 space-y-3"><Shirt className="w-12 h-12 text-gray-700" /><p className="text-sm text-gray-500">Design prompt created but image generation is unavailable.</p><p className="text-xs text-gray-600 max-w-sm text-center">The Imagen API may not be enabled. The design prompt is ready for any image generator.</p></div>)}
              </div>
            </div>
            {designPrompt && (<div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Design Prompt</label>
              <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 relative group"><p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{designPrompt}</p><button onClick={handleCopyPrompt} className="absolute top-3 right-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg transition opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white" title="Copy prompt"><Copy className="w-4 h-4" /></button></div>
            </div>)}
            <div className="flex gap-3">
              <button onClick={handleRetry} className="flex-1 bg-white/10 border border-white/10 text-white font-bold uppercase py-3 rounded-xl hover:bg-white/20 transition flex items-center justify-center gap-2 text-sm"><RefreshCw className="w-4 h-4" />Try Again</button>
              <button onClick={() => { if (generatedDesign) onDesignGenerated(generatedDesign, designPrompt); onClose(); }} className="flex-1 bg-white text-black font-bold uppercase py-3 rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-2 text-sm shadow-lg"><Check className="w-4 h-4" />Use This Design</button>
            </div>
          </div>)}
        </div>
        <div className="p-4 bg-black/50 border-t border-gray-800 shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-2"><Shirt className="w-3 h-3" /><span className="uppercase tracking-widest font-bold">Coalition Design Lab</span></div>
            <span>Powered by Gemini Vision + Imagen</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShirtGeneratorModal;
