import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Image as ImageIcon, Sparkles, Copy, 
  RefreshCw, Check, AlertCircle, PenTool, Download, Stamp, X, Plus, SlidersHorizontal, Sun, Contrast, Droplet, Triangle,
  Search, FileText, Instagram, BookOpen
} from 'lucide-react';

// --- Configuration ---
const API_KEY = 'AIzaSyDdwsNqwYWxaRe9dFJNHmARhvF3EZ-o2LE';
const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';

// --- Global Styles ---
const GlobalStyles = () => (
  <style>{`
    body {
      margin: 0;
      padding: 0;
      background-color: #F7F6F2;
    }
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: #f1f1f1; 
    }
    ::-webkit-scrollbar-thumb {
      background: #d6d3ce; 
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #8B7355; 
    }
  `}</style>
);

// --- System Prompts ---
const MAIN_SYSTEM_PROMPT = `
你現在是「璞石好室 (Pure House)」的品牌主理人與資深空間敘事者。
你的品牌核心是：「返璞歸真」、「耐住型設計」、「時間的質感」、「真材實料」。

任務：根據使用者上傳的一組室內設計圖片，撰寫三種不同風格的 Facebook 貼文文案。
請綜合分析所有圖片，找出貫穿全案的設計靈魂。

請仔細觀察圖片中的：
1. 材質細節（木紋、石材、塗料、金屬收邊）。
2. 光影變化（自然光、間接照明）。
3. 生活痕跡（收納、動線、家具擺設）。

絕對禁止：
- 禁止使用「奢華」、「CP值」、「豪宅」、「夢幻」、「高大上」等庸俗字眼。
- 禁止過度堆砌形容詞。
- 不要像個銷售員，要像個懂生活的建築師。

請嚴格依照以下格式輸出，將三種風格整合在一起，中間用分隔線區隔，方便閱讀：

【選項一：時光的容器】
（請在此撰寫感性、強調時間與陪伴的文案。語氣溫暖、深沉、有電影感。）
（文案結束後，請列出 3-5 個適合此風格的 Hashtags）

---

【選項二：璞石的細節】
（請在此撰寫理性、強調工藝與材質的文案。描述圖片中的材質細節，並連結到「耐住指標」。）
（文案結束後，請列出 3-5 個適合此風格的 Hashtags）

---

【選項三：極簡的留白】
（請在此撰寫三行詩或簡短有力的金句。留白，讓圖片說話。）
（文案結束後，請列出 3-5 個適合此風格的 Hashtags）
`;

const MATERIAL_PROMPT = `
你是一位專業的室內設計材質分析師。請觀察這張圖片，列出畫面中出現的 3-5 種關鍵材質或設計元素。
請用簡潔的「名詞」列出即可，不需要完整句子。
例如：橡木實木地板、特殊礦物塗料、霧面黑色五金、人造石檯面。
請用繁體中文回答，中間用頓號隔開。
`;

const REWRITE_PROMPT_IG = `
請將上述的室內設計文案，改寫成一篇適合「Instagram 限時動態 (Story)」的短文。
要求：
1. 字數控制在 50 字以內。
2. 語氣更輕快、更像是在跟朋友分享。
3. 這是要壓在圖片上的文字，所以要精簡有力，直擊重點。
4. 不需要標題，不需要 Hashtags。
`;

const REWRITE_PROMPT_BLOG = `
請將上述的室內設計文案，擴寫成一篇適合「官方部落格 (Blog)」的深度文章段落。
要求：
1. 深入探討設計背後的思考，例如為什麼選擇這個材質？為什麼這樣規劃動線？
2. 強調「璞石好室」對於「耐住、好整理、好維修」的專業堅持。
3. 語氣專業且感性，字數約 300-400 字。
4. 不需要 Hashtags。
`;

const AIWriterApp = () => {
  // 狀態管理
  const [images, setImages] = useState([]); 
  const [selectedImageId, setSelectedImageId] = useState(null); 
  const [temperature, setTemperature] = useState(0.7); 
  
  const [loading, setLoading] = useState(false);
  const [rawResult, setRawResult] = useState(null);
  const [error, setError] = useState(null);
  
  // 新功能狀態
  const [materials, setMaterials] = useState(null);
  const [analyzingMaterials, setAnalyzingMaterials] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState(null);
  const [rewriteType, setRewriteType] = useState(null); 

  // 用於即時預覽的 URL
  const [livePreviewUrl, setLivePreviewUrl] = useState(null);
  
  const fileInputRef = useRef(null);

  // 處理圖片上傳
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (images.length + files.length > 10) {
      setError('一次最多只能上傳 10 張圖片');
      return;
    }

    const newImages = [];
    
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const base64Promise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      const url = URL.createObjectURL(file);
      const id = Date.now() + Math.random().toString(36).substr(2, 9);

      newImages.push({
        id,
        file,
        originalUrl: url,
        base64,
        isWatermarked: false,
        edits: {
          brightness: 100,
          contrast: 100,
          saturate: 100,
          sharpness: 0,
        }
      });
    }

    setImages(prev => [...prev, ...newImages]);
    setError(null);
    setMaterials(null); 
    setRewriteResult(null); 
    
    if (!selectedImageId && newImages.length > 0) {
      setSelectedImageId(newImages[0].id);
    }
  };

  const removeImage = (idToRemove) => {
    setImages(prev => {
      const newImages = prev.filter(img => img.id !== idToRemove);
      if (selectedImageId === idToRemove) {
        setSelectedImageId(newImages.length > 0 ? newImages[0].id : null);
      }
      return newImages;
    });
  };

  const selectedImage = images.find(img => img.id === selectedImageId);

  // 更新修圖參數
  const updateImageEdit = (param, value) => {
    if (!selectedImageId) return;
    setImages(prev => prev.map(img => {
      if (img.id === selectedImageId) {
        const newEdits = { ...img.edits, [param]: value };
        return { ...img, edits: newEdits, isWatermarked: false };
      }
      return img;
    }));
  };

  // 銳利化演算法
  const applySharpen = (ctx, width, height, amount) => {
    if (amount <= 0) return;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const w = width;
    const h = height;
    const mix = (amount / 100) * 0.8; 
    const weights = [
        -mix, -mix, -mix,
        -mix, 1 + (8 * mix), -mix,
        -mix, -mix, -mix
    ];
    const buffer = new Uint8ClampedArray(data);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        const i0 = i - w*4 - 4; const i1 = i - w*4; const i2 = i - w*4 + 4;
        const i3 = i - 4;       const i4 = i;       const i5 = i + 4;
        const i6 = i + w*4 - 4; const i7 = i + w*4; const i8 = i + w*4 + 4;
        for (let c = 0; c < 3; c++) {
          data[i+c] = buffer[i0+c]*weights[0] + buffer[i1+c]*weights[1] + buffer[i2+c]*weights[2] + buffer[i3+c]*weights[3] + buffer[i4+c]*weights[4] + buffer[i5+c]*weights[5] + buffer[i6+c]*weights[6] + buffer[i7+c]*weights[7] + buffer[i8+c]*weights[8];
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  // 核心影像處理
  const processImageToCanvas = async (imgObj, withWatermark = false) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imgObj.originalUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;

    const { brightness, contrast, saturate, sharpness } = imgObj.edits;
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';

    if (sharpness > 0) {
      applySharpen(ctx, canvas.width, canvas.height, sharpness);
    }

    if (withWatermark) {
      const scaleFactor = Math.min(canvas.width, canvas.height) / 1000; 
      const paddingX = 60 * scaleFactor;
      const paddingY = 60 * scaleFactor;
      const centerX = canvas.width - paddingX - (150 * scaleFactor); 
      const bottomY = canvas.height - paddingY; 

      ctx.shadowColor = "rgba(0, 0, 0, 0.7)"; 
      ctx.shadowBlur = 8 * scaleFactor; 
      ctx.shadowOffsetX = 2 * scaleFactor;
      ctx.shadowOffsetY = 2 * scaleFactor;

      ctx.strokeStyle = "#C5A585"; 
      ctx.lineWidth = 4 * scaleFactor;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const waveWidth = 140 * scaleFactor;
      const waveHeight = 75 * scaleFactor; 
      const waveY = bottomY - (130 * scaleFactor); 
      const startX = centerX - (waveWidth / 2);

      ctx.beginPath();
      ctx.moveTo(startX, waveY);
      ctx.bezierCurveTo(startX + (waveWidth * 0.25), waveY - waveHeight, startX + (waveWidth * 0.5), waveY + (waveHeight * 0.5), centerX + (waveWidth / 2), waveY);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const fontSizeCN = 48 * scaleFactor;
      ctx.font = `500 ${fontSizeCN}px "Noto Serif TC", "Songti TC", serif`;
      const cnY = bottomY - (50 * scaleFactor);
      ctx.fillStyle = "#1C1C1C"; 
      ctx.fillText("璞 石 好 室", centerX, cnY);

      const fontSizeEN = 18 * scaleFactor;
      ctx.font = `600 ${fontSizeEN}px "Montserrat", "Helvetica Neue", sans-serif`;
      const textEN = "P U R E   H O U S E";
      const enY = bottomY;
      ctx.fillStyle = "#1C1C1C"; 
      ctx.fillText(textEN, centerX, enY);
    }
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  // 即時預覽 Effect
  useEffect(() => {
    if (!selectedImage) {
      setLivePreviewUrl(null);
      return;
    }
    if (selectedImage.isWatermarked) return;

    const timer = setTimeout(async () => {
      try {
        const url = await processImageToCanvas(selectedImage, false);
        setLivePreviewUrl(url);
      } catch (err) {
        console.error("Preview failed", err);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedImage]); 

  const handleApplyWatermark = async () => {
    if (!selectedImage) return;
    if (selectedImage.isWatermarked) {
      setImages(prev => prev.map(img => img.id === selectedImageId ? { ...img, isWatermarked: false } : img));
    } else {
      setLoading(true);
      try {
        const urlWithLogo = await processImageToCanvas(selectedImage, true);
        setImages(prev => prev.map(img => img.id === selectedImageId ? { ...img, previewUrl: urlWithLogo, isWatermarked: true } : img));
        setLivePreviewUrl(urlWithLogo);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDownload = async () => {
    if (!selectedImage) return;
    const url = await processImageToCanvas(selectedImage, selectedImage.isWatermarked);
    const a = document.createElement('a');
    a.href = url;
    const suffix = selectedImage.isWatermarked ? '_Logo' : '_Edit';
    a.download = `PureHouse_${Date.now()}${suffix}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const callGemini = async (prompt, imageParts = []) => {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            ...imageParts 
          ]
        }
      ],
      generationConfig: {
        temperature: temperature, 
        maxOutputTokens: 4000,
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  };

  const generateContent = async () => {
    if (images.length === 0) {
      setError('請至少上傳一張圖片');
      return;
    }
    setLoading(true);
    setError(null);
    setRawResult(null); 
    setMaterials(null);
    setRewriteResult(null);

    try {
      const imageParts = images.map(img => ({
        inlineData: { mimeType: img.file.type, data: img.base64 }
      }));
      const text = await callGemini(MAIN_SYSTEM_PROMPT, imageParts);
      if (text) {
        setRawResult(text);
      } else {
        throw new Error("無法生成內容，請重試。");
      }
    } catch (err) {
      console.error(err);
      setError(`生成失敗: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✨ 新功能：材質分析
  const analyzeMaterials = async () => {
    if (!selectedImage) return;
    setAnalyzingMaterials(true);
    try {
      const imagePart = [{
        inlineData: { mimeType: selectedImage.file.type, data: selectedImage.base64 }
      }];
      const text = await callGemini(MATERIAL_PROMPT, imagePart);
      if (text) setMaterials(text);
    } catch (err) {
      console.error("Material analysis failed", err);
    } finally {
      setAnalyzingMaterials(false);
    }
  };

  // ✨ 新功能：文案改寫
  const rewriteContent = async (type) => {
    if (!rawResult) return; 
    setRewriting(true);
    setRewriteType(type);
    setRewriteResult(null);
    
    try {
      const prompt = type === 'IG' ? REWRITE_PROMPT_IG : REWRITE_PROMPT_BLOG;
      const fullPrompt = `${prompt}\n\n原始文案：\n${rawResult}`;
      
      const text = await callGemini(fullPrompt, []);
      if (text) setRewriteResult(text);
    } catch (err) {
      console.error("Rewrite failed", err);
    } finally {
      setRewriting(false);
    }
  };

  const copyToClipboard = (text, successMessage) => {
    if (!text) return;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      if (successMessage) alert(successMessage);
    } catch (err) {
      console.error('Copy failed', err);
      alert("複製失敗，請手動複製。");
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="min-h-screen font-sans text-stone-800 selection:bg-[#D2C4B5] selection:text-white flex flex-col">
      <GlobalStyles />
      
      {/* Header */}
      <header className="bg-stone-900 text-stone-300 py-6 px-6 border-b border-stone-800 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#D2C4B5] text-stone-900 flex items-center justify-center rounded-sm font-serif font-bold text-xl">PH</div>
            <div>
              <h1 className="text-xl font-bold font-serif text-white tracking-wide">璞石文案助手</h1>
              <p className="text-xs text-stone-500 tracking-widest uppercase">Pure House AI Writer</p>
            </div>
          </div>
          <div className="hidden md:block text-xs text-stone-500">
            Internal Tool v5.7 (Integrated Single File)
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid lg:grid-cols-2 gap-8">
        
        {/* Left Column: Image Management */}
        <div className="flex flex-col gap-6">
          <div className="bg-white p-6 rounded-lg border border-stone-200 shadow-sm h-full flex flex-col">
            <h2 className="text-lg font-bold font-serif mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2"><ImageIcon className="text-[#8B7355]" size={20} /> 圖片工作台 ({images.length}/10)</span>
              
              {selectedImage && (
                <div className="flex gap-2">
                   <button 
                     onClick={handleApplyWatermark}
                     className={`text-xs px-3 py-1 rounded-full border transition-all flex items-center gap-1 ${selectedImage.isWatermarked ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}
                   >
                     <Stamp size={12} />
                     {selectedImage.isWatermarked ? '移除 Logo' : '壓上 Logo'}
                   </button>
                   
                   <button 
                     onClick={handleDownload}
                     className="text-xs px-3 py-1 rounded-full bg-[#8B7355] text-white hover:bg-[#705C44] transition-all flex items-center gap-1"
                   >
                     <Download size={12} />
                     下載
                   </button>
                </div>
              )}
            </h2>
            
            {/* Main Preview Area */}
            <div 
              className={`
                relative border-2 border-dashed rounded-lg h-80 flex flex-col items-center justify-center transition-all overflow-hidden bg-stone-900 mb-4
                ${!selectedImage ? 'border-[#8B7355] bg-[#F7F6F2] cursor-pointer hover:bg-[#EBE9E1]' : 'border-stone-300'}
              `}
              onClick={() => !selectedImage && fileInputRef.current.click()}
            >
              {selectedImage ? (
                <img 
                  src={selectedImage.isWatermarked ? selectedImage.previewUrl : (livePreviewUrl || selectedImage.originalUrl)} 
                  alt="Preview" 
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-center p-6 text-stone-400">
                  <Upload className="mx-auto h-12 w-12 text-[#8B7355] mb-3" />
                  <p className="text-sm font-medium text-stone-600">點擊或拖曳上傳 (最多 10 張)</p>
                  <p className="text-xs text-stone-400 mt-1">AI 將綜合所有圖片生成文案</p>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-300">
              {images.map(img => (
                <div 
                  key={img.id} 
                  className={`relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border-2 cursor-pointer transition-all ${selectedImageId === img.id ? 'border-[#8B7355] ring-2 ring-[#8B7355]/30' : 'border-stone-200 hover:border-stone-400'}`}
                  onClick={() => setSelectedImageId(img.id)}
                >
                  <img 
                    src={img.originalUrl} 
                    className="w-full h-full object-cover" 
                    alt="thumbnail" 
                    style={{
                      filter: `brightness(${img.edits.brightness}%) contrast(${img.edits.contrast}%)`
                    }}
                  />
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-80 hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                  {img.isWatermarked && (
                     <div className="absolute bottom-0 right-0 bg-stone-800 text-white text-[8px] px-1 rounded-tl">LOGO</div>
                  )}
                </div>
              ))}
              
              {images.length < 10 && (
                <button 
                  onClick={() => fileInputRef.current.click()}
                  className="w-16 h-16 flex-shrink-0 flex flex-col items-center justify-center border-2 border-dashed border-stone-300 rounded-md hover:bg-stone-50 text-stone-400 hover:text-[#8B7355] transition-colors"
                >
                  <Plus size={20} />
                  <span className="text-[10px] mt-1">新增</span>
                </button>
              )}
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              multiple 
              className="hidden" 
            />

            {/* ✨ NEW FEATURE: Material Scanner */}
            {selectedImage && (
              <div className="mt-2 flex items-center justify-between p-3 bg-stone-50 rounded border border-stone-100">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-[#8B7355]" />
                  <span className="text-xs font-bold text-stone-600">AI 材質透視</span>
                </div>
                {materials ? (
                  <div className="flex flex-wrap gap-1 justify-end max-w-[70%]">
                    {materials.split('、').map((mat, idx) => (
                      <span key={idx} className="text-[10px] bg-white border border-stone-200 px-2 py-0.5 rounded text-stone-600">{mat.trim()}</span>
                    ))}
                  </div>
                ) : (
                  <button 
                    onClick={analyzeMaterials}
                    disabled={analyzingMaterials}
                    className="text-[10px] px-2 py-1 bg-white border border-stone-300 rounded hover:bg-stone-100 flex items-center gap-1"
                  >
                    {analyzingMaterials ? <RefreshCw className="animate-spin" size={10} /> : <Sparkles size={10} />}
                    分析圖中材質
                  </button>
                )}
              </div>
            )}

            {/* Photo Editor Section */}
            {selectedImage && (
              <div className="mt-4 p-4 bg-stone-50 rounded border border-stone-100">
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <SlidersHorizontal size={14} /> 影像調校
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {/* Exposure */}
                  <div className="flex items-center gap-2">
                    <Sun size={14} className="text-stone-400" />
                    <span className="text-xs text-stone-600 w-8">曝光</span>
                    <input 
                      type="range" min="50" max="150" step="5"
                      value={selectedImage.edits.brightness}
                      onChange={(e) => updateImageEdit('brightness', e.target.value)}
                      className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#8B7355]"
                    />
                  </div>
                  {/* Contrast */}
                  <div className="flex items-center gap-2">
                    <Contrast size={14} className="text-stone-400" />
                    <span className="text-xs text-stone-600 w-8">對比</span>
                    <input 
                      type="range" min="50" max="150" step="5"
                      value={selectedImage.edits.contrast}
                      onChange={(e) => updateImageEdit('contrast', e.target.value)}
                      className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#8B7355]"
                    />
                  </div>
                  {/* Saturation */}
                  <div className="flex items-center gap-2">
                    <Droplet size={14} className="text-stone-400" />
                    <span className="text-xs text-stone-600 w-8">鮮豔</span>
                    <input 
                      type="range" min="0" max="200" step="10"
                      value={selectedImage.edits.saturate}
                      onChange={(e) => updateImageEdit('saturate', e.target.value)}
                      className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#8B7355]"
                    />
                  </div>
                  {/* Sharpness */}
                  <div className="flex items-center gap-2">
                    <Triangle size={14} className="text-stone-400" />
                    <span className="text-xs text-stone-600 w-8">清晰</span>
                    <input 
                      type="range" min="0" max="100" step="10"
                      value={selectedImage.edits.sharpness}
                      onChange={(e) => updateImageEdit('sharpness', e.target.value)}
                      className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#8B7355]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Config Section */}
            <div className="mt-auto border-t border-stone-100 pt-4">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-sm font-bold flex items-center gap-2 text-stone-700">
                   文案溫度計
                 </h3>
                 <span className="text-xs font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-500">{temperature}</span>
               </div>
               
               <input 
                 type="range" min="0.1" max="1.0" step="0.1" value={temperature}
                 onChange={(e) => setTemperature(parseFloat(e.target.value))}
                 className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#8B7355]"
               />
               
               <div className="flex justify-between text-[10px] text-stone-400 mt-2 font-medium">
                 <span>理性</span><span className="text-[#8B7355]">0.7</span><span>感性</span>
               </div>
            </div>

            {/* Generate Button */}
            <button 
              onClick={generateContent}
              disabled={loading || images.length === 0}
              className={`
                w-full mt-4 py-4 rounded-sm font-medium flex items-center justify-center gap-2 transition-all shadow-md text-lg
                ${loading || images.length === 0
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed' 
                  : 'bg-[#8B7355] text-white hover:bg-[#705C44]'}
              `}
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  正在構思...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  生成三種提案
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded flex items-center gap-2 border border-red-100">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Results */}
        <div className="flex flex-col h-full gap-6">
          <div className="bg-white p-6 rounded-lg border border-stone-200 shadow-sm flex-1 overflow-y-auto">
             <div className="flex items-center justify-between mb-6 border-b border-stone-100 pb-4">
                <h2 className="text-lg font-bold font-serif flex items-center gap-2">
                  <Sparkles className="text-[#8B7355]" size={20} />
                  AI 文案建議
                </h2>
                {rawResult && (
                  <span className="text-xs text-stone-400 bg-stone-100 px-2 py-1 rounded">
                    已參考 {images.length} 張圖片
                  </span>
                )}
             </div>

            {!rawResult ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 min-h-[300px]">
                <Sparkles className="mb-4 opacity-20" size={48} />
                <p>上傳圖片，調整喜歡的風格溫度，</p>
                <p className="text-sm">AI 將為您撰寫三種不同語氣的文案。</p>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in pb-4">
                
                {/* Unified Result Box */}
                <div className="relative bg-[#F9F9F7] p-6 rounded border border-stone-100 group hover:border-[#8B7355]/30 transition-colors flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-[#8B7355] text-sm uppercase tracking-wide">
                      文案提案
                    </h3>
                    <CopyButton text={rawResult} />
                  </div>
                  
                  <div className="text-stone-700 whitespace-pre-wrap text-base leading-relaxed mb-6 font-medium">
                    {rawResult}
                  </div>
                  
                  {/* Bottom Action Bar */}
                  <div className="mt-auto pt-4 border-t border-stone-200/50">
                    <button 
                      onClick={() => copyToClipboard(rawResult, "所有提案已複製")}
                      className="w-full py-3 bg-white border border-stone-200 text-stone-600 text-sm font-medium rounded hover:bg-stone-50 hover:text-[#8B7355] hover:border-[#8B7355] transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Copy size={16} /> 複製所有提案
                    </button>
                  </div>
                </div>

                {/* ✨ NEW FEATURE: Magic Rewrite Buttons */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <button
                    onClick={() => rewriteContent('IG')}
                    disabled={rewriting}
                    className="p-4 rounded border border-stone-200 bg-white hover:bg-gradient-to-tr hover:from-purple-50 hover:to-orange-50 transition-all group text-left"
                  >
                    <div className="flex items-center gap-2 mb-2 text-stone-800 font-bold text-sm">
                      <Instagram size={16} className="text-[#C13584]" />
                      轉 IG 限動
                    </div>
                    <p className="text-xs text-stone-500">50字內，輕快語氣</p>
                  </button>

                  <button
                    onClick={() => rewriteContent('BLOG')}
                    disabled={rewriting}
                    className="p-4 rounded border border-stone-200 bg-white hover:bg-stone-50 transition-all group text-left"
                  >
                    <div className="flex items-center gap-2 mb-2 text-stone-800 font-bold text-sm">
                      <BookOpen size={16} className="text-[#8B7355]" />
                      轉 Blog 長文
                    </div>
                    <p className="text-xs text-stone-500">深度解析，專業感</p>
                  </button>
                </div>

                {/* Rewrite Result Area */}
                {rewriting && (
                  <div className="p-4 text-center text-stone-400 text-sm animate-pulse">
                    <RefreshCw className="inline-block animate-spin mr-2" size={16} />
                    AI 正在施展魔法改寫中...
                  </div>
                )}

                {rewriteResult && (
                  <div className="relative bg-white p-6 rounded border border-[#8B7355]/50 shadow-sm animate-fade-in border-l-4 border-l-[#8B7355]">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-[#8B7355] text-sm uppercase tracking-wide">
                        {rewriteType === 'IG' ? 'Instagram 限動版' : 'Blog 深度版'}
                      </h3>
                      <CopyButton text={rewriteResult} />
                    </div>
                    <p className="text-stone-700 whitespace-pre-wrap text-sm leading-relaxed">
                      {rewriteResult}
                    </p>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-stone-400 text-xs border-t border-stone-200">
        &copy; 2026 Pure House Strategy Lab. Powered by Gemini 1.5 Flash.
      </footer>
    </div>
  );
};

// 獨立的複製按鈕組件
const CopyButton = ({ text, label = "複製" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!text) return;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <button 
      onClick={handleCopy}
      className={`
        text-xs px-2 py-1 rounded flex items-center gap-1 transition-all opacity-80 hover:opacity-100
        ${copied 
          ? 'bg-green-100 text-green-700' 
          : 'bg-white text-stone-500 hover:bg-stone-100 border border-stone-200 shadow-sm'}
      `}
      title="複製此段文案"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      <span className="hidden sm:inline">{copied ? '已複製' : label}</span>
    </button>
  );
};

export default AIWriterApp;