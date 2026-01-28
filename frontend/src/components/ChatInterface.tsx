import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { TripPlan } from '../App';
import { useAuth } from '../context/AuthContext';

interface Message {
    role: 'user' | 'model';
    content: string;
}

interface ChatInterfaceProps {
    onPlanReady: (plan: TripPlan) => void;
}

export default function ChatInterface({ onPlanReady }: ChatInterfaceProps) {
    const { token } = useAuth();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: "Hello. I'm your dedicated travel concierge. Where would you like to travel?" }
    ]);
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Initialize Speech Recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                handleSend(transcript);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
                alert("Voice Error: " + event.error + ". Please check your microphone permissions.");
            };
        } else {
            console.warn("Web Speech API not supported in this browser.");
        }
    }, []);

    // Text-to-Speech Logic
    useEffect(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'model' && !isMuted && lastMsg.content) {
            const utterance = new SpeechSynthesisUtterance(lastMsg.content);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            window.speechSynthesis.cancel(); // Stop previous
            window.speechSynthesis.speak(utterance);
        }
    }, [messages, isMuted]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const handleSend = async (text: string = input) => {
        if (!text.trim() || loading) return;

        const userMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/api/chat`, {
                message: userMsg.content,
                history: messages
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = res.data;

            if (data.action === 'plan_ready' && data.plan) {
                setMessages(prev => [...prev, { role: 'model', content: data.response }]);
                setTimeout(() => {
                    onPlanReady(data.plan);
                }, 1500);
            } else {
                setMessages(prev => [...prev, { role: 'model', content: data.response || "I didn't quite catch that." }]);
            }

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'model', content: "I am currently offline. Please check your connection." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            background: '#0f172a',
            borderRadius: '16px',
            border: '1px solid #1e293b',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            height: '650px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '-0.01em'
        }}>
            {/* Professional Header */}
            <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #1e293b',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#0f172a'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '32px', height: '32px',
                        background: '#3b82f6',
                        borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <i className="fa-solid fa-compass" style={{ color: 'white', fontSize: '1rem' }}></i>
                    </div>
                    <div>
                        <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem', display: 'block' }}>Trip Assistant</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <div style={{ width: '6px', height: '6px', background: '#22c55e', borderRadius: '50%' }}></div>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Online</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {/* Voice Mute Toggle */}
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        style={{
                            background: 'transparent',
                            border: '1px solid #334155',
                            color: isMuted ? '#64748b' : '#3b82f6',
                            borderRadius: '6px',
                            width: '32px', height: '32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                        title={isMuted ? "Unmute Voice" : "Mute Voice"}
                    >
                        <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                    </button>

                    <button
                        onClick={() => setMessages([{ role: 'model', content: "Hello. I'm your dedicated travel concierge. Where would you like to travel?" }])}
                        style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Clear Chat
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#0f172a' }} className="custom-scrollbar">
                <AnimatePresence>
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '80%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                            }}
                        >
                            <span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.3rem', marginLeft: '0.5rem', marginRight: '0.5rem' }}>
                                {msg.role === 'user' ? 'You' : 'Assistant'}
                            </span>
                            <div style={{
                                background: msg.role === 'user' ? '#3b82f6' : '#1e293b',
                                color: msg.role === 'user' ? '#ffffff' : '#e2e8f0',
                                padding: '0.8rem 1.25rem',
                                borderRadius: '12px',
                                borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                                borderTopLeftRadius: msg.role === 'model' ? '2px' : '12px',
                                lineHeight: '1.6',
                                fontSize: '0.95rem',
                                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                            }}>
                                {msg.content}
                            </div>
                        </motion.div>
                    ))}
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{ alignSelf: 'flex-start' }}
                        >
                            <div style={{
                                background: '#1e293b',
                                padding: '0.75rem 1rem',
                                borderRadius: '12px',
                                borderTopLeftRadius: '2px',
                                display: 'flex', gap: '0.4rem', alignItems: 'center'
                            }}>
                                <div className="typing-dot"></div>
                                <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                                <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '1.25rem', background: '#0f172a', borderTop: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>

                    {/* Mic Button */}
                    <button
                        onClick={toggleListening}
                        style={{
                            background: isListening ? '#ef4444' : '#1e293b',
                            color: 'white',
                            border: '1px solid #334155',
                            width: '46px',
                            height: '46px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                            flexShrink: 0,
                            animation: isListening ? 'pulse 1.5s infinite' : 'none'
                        }}
                    >
                        <i className={`fa-solid ${isListening ? 'fa-microphone-slash' : 'fa-microphone'}`} style={{ fontSize: '1rem' }}></i>
                    </button>

                    <div style={{ flex: 1, position: 'relative' }}>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={isListening ? "Listening..." : "Type a message..."}
                            rows={1}
                            style={{
                                width: '100%',
                                padding: '0.8rem 1rem',
                                borderRadius: '10px',
                                border: '1px solid #334155',
                                background: '#1e293b',
                                color: 'white',
                                fontSize: '0.95rem',
                                outline: 'none',
                                resize: 'none',
                                minHeight: '46px',
                                fontFamily: 'inherit',
                                lineHeight: '1.5'
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                            onBlur={e => e.currentTarget.style.borderColor = '#334155'}
                        />
                    </div>
                    <button
                        onClick={() => handleSend()}
                        disabled={loading || !input.trim()}
                        style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            width: '46px',
                            height: '46px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
                        onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
                    >
                        <i className="fa-solid fa-paper-plane" style={{ fontSize: '1rem' }}></i>
                    </button>
                </div>

                {/* Minimal Chips */}
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', overflowX: 'auto' }} className="no-scrollbar">
                    {['Plan a 3-day trip', 'Budget trip to Goa', 'Honeymoon destinations', 'Adventure in Manali'].map(s => (
                        <button
                            key={s}
                            onClick={() => handleSend(s)}
                            style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                padding: '0.3rem 0.8rem',
                                borderRadius: '6px',
                                color: '#94a3b8',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s',
                                fontWeight: 500
                            }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <style>{`
                .typing-dot {
                    width: 5px; height: 5px; background: #94a3b8;
                    border-radius: 50%;
                    animation: typing 1.4s infinite ease-in-out both;
                }
                @keyframes typing {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
