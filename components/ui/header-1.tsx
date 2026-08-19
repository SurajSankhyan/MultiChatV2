'use client';
import React from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

export function Header() {
	const [open, setOpen] = React.useState(false);
	const [setupOpen, setSetupOpen] = React.useState(false);
	const [authOpen, setAuthOpen] = React.useState(false);
	const [isSignUp, setIsSignUp] = React.useState(false);
	const [email, setEmail] = React.useState('');
	const [password, setPassword] = React.useState('');
	const [channelId, setChannelId] = React.useState('');
	const [authError, setAuthError] = React.useState<string | null>(null);
	const [authLoading, setAuthLoading] = React.useState(false);
	const [signUpSuccess, setSignUpSuccess] = React.useState(false);

	const [user, setUser] = React.useState<any>(null);
	const [profile, setProfile] = React.useState<any>(null);
	const [copied, setCopied] = React.useState(false);
	const scrolled = useScroll(10);

	const links = [
		{
			label: 'Features',
			href: '#',
		},
		{
			label: 'Pricing',
			href: '#',
		},
		{
			label: 'About',
			href: '#',
		},
	];

	const nightbotCommand = '!addcom !clip $(urlfetch https://yt-timestamp-central-auth-project.onrender.com/api/clip?streamerId=$(channelid)&chatid=$(request_id)&text=$(querystring)&user=$(user)&userlevel=$(userlevel)&channelId=$(userid))';

	const handleCopy = () => {
		navigator.clipboard.writeText(nightbotCommand).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	// Auth State Listener
	React.useEffect(() => {
		const fetchSession = async () => {
			const { data: { session } } = await supabase.auth.getSession();
			if (session?.user) {
				setUser(session.user);
				const { data: profileData } = await supabase
					.from('profiles')
					.select('role, channel_id, channel_name, avatar_url')
					.eq('id', session.user.id)
					.single();
				setProfile(profileData);
			} else {
				setUser(null);
				setProfile(null);
			}
		};

		fetchSession();

		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
			if (session?.user) {
				setUser(session.user);
				const { data: profileData } = await supabase
					.from('profiles')
					.select('role, channel_id, channel_name, avatar_url')
					.eq('id', session.user.id)
					.single();
				setProfile(profileData);
			} else {
				setUser(null);
				setProfile(null);
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	React.useEffect(() => {
		if (open || setupOpen || authOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	}, [open, setupOpen, authOpen]);

	const handleAuthSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setAuthError(null);
		setAuthLoading(true);
		setSignUpSuccess(false);

		try {
			if (isSignUp) {
				const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
					email,
					password,
				});
				if (signUpErr) throw signUpErr;

				if (signUpData.user) {
					const { error: profileErr } = await supabase
						.from('profiles')
						.upsert([
							{
								id: signUpData.user.id,
								email: email,
								role: 'creator',
								channel_id: channelId,
								channel_name: email.split('@')[0],
							}
						]);
					if (profileErr) throw profileErr;
					setSignUpSuccess(true);
					setTimeout(() => {
						setIsSignUp(false);
						setEmail('');
						setPassword('');
						setChannelId('');
					}, 2000);
				}
			} else {
				const { error: signInErr } = await supabase.auth.signInWithPassword({
					email,
					password,
				});
				if (signInErr) throw signInErr;
				setAuthOpen(false);
				setEmail('');
				setPassword('');
			}
		} catch (err: any) {
			setAuthError(err.message || 'An error occurred during authentication');
		} finally {
			setAuthLoading(false);
		}
	};

	const handleLogout = async () => {
		await supabase.auth.signOut();
	};

	return (
		<>
			<header
				className={cn('sticky top-0 z-50 w-full border-b border-transparent transition-all duration-300', {
					'bg-[#0a0b14]/80 border-white/[0.08] backdrop-blur-md shadow-lg': scrolled,
				})}
			>
				<nav className="mx-auto flex h-14 w-full max-w-none items-center justify-between px-6 md:px-12">
					{/* Left: Logo */}
					<div className="flex items-center">
						<a href="/" className="flex items-center hover:bg-accent rounded-md p-2 transition-colors">
							<WordmarkIcon className="h-4 text-white" />
						</a>
					</div>

					{/* Right: Actions (Contains nav links and action buttons) */}
					<div className="hidden items-center gap-3 md:flex">
						{/* Features, Pricing, About Links */}
						<div className="flex items-center gap-6 mr-3">
							{links.map((link) => (
								<a 
									key={link.label} 
									className="text-[14px] font-semibold text-slate-300 hover:text-white transition-colors" 
									href={link.href}
								>
									{link.label}
								</a>
							))}
						</div>

						{/* Setup Guide Button */}
						<Button 
							variant="outline" 
							onClick={() => setSetupOpen(true)} 
							className="border-purple-500/30 bg-purple-500/10 text-purple-300 hover:text-white hover:bg-purple-600/20 hover:border-purple-500/50 rounded-lg text-sm font-semibold px-4 h-9"
						>
							Setup Guide
						</Button>

						{/* Classic View Link */}
						<a 
							href="/" 
							className={cn(
								buttonVariants({ variant: 'outline' }), 
								"border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/20 rounded-lg text-sm font-semibold px-4 h-9 flex items-center justify-center"
							)}
						>
							Classic View
						</a>

						{/* Authentication States */}
						{user ? (
							<div className="flex items-center gap-3 ml-2">
								{/* Sliding Profile Card from main website */}
								<div className="profile-card cursor-pointer select-none">
									<div className="profile-card-outer">
										<div className="profile-card-inner">
											<div className="profile-avatar-wrapper">
												<div className="profile-glow"></div>
												<img 
													className="profile-avatar-img" 
													src={profile?.avatar_url || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzFlMjkzYiIvPjxjaXJjbGUgY3g9Ijc1IiBjeT0iNzUiIHI9IjQwIiBmaWxsPSIjNDc1NTY5Ii8+PC9zdmc+"} 
													alt="avatar" 
												/>
												<div className="profile-status-dot"></div>
											</div>
											<div className="profile-text-content">
												<div className="profile-name-row">
													<h3 className="profile-name-text">{profile?.channel_name || user.email?.split('@')[0] || 'Admin'}</h3>
												</div>
												<div className="profile-role-row">
													<span className="profile-role-text">{profile?.role || 'Creator'}</span>
												</div>
											</div>
										</div>
									</div>
								</div>

								{/* Logout button */}
								<button onClick={handleLogout} className="Btn">
									<div className="sign">
										<svg viewBox="0 0 512 512">
											<path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z"></path>
										</svg>
									</div>
									<div className="text">Logout</div>
								</button>
							</div>
						) : (
							<div className="flex items-center gap-2">
								<Button 
									variant="outline" 
									onClick={() => { setIsSignUp(false); setAuthError(null); setAuthOpen(true); }} 
									className="border-white/15 bg-black/40 text-white hover:bg-white/5 rounded-lg text-sm font-bold px-4 h-9"
								>
									Sign In
								</Button>
								<Button 
									onClick={() => { setIsSignUp(true); setAuthError(null); setAuthOpen(true); }}
									className="bg-slate-100 text-black hover:bg-white rounded-lg text-sm font-bold px-4 h-9"
								>
									Get Started
								</Button>
							</div>
						)}
					</div>

					<Button
						size="icon"
						variant="outline"
						onClick={() => setOpen(!open)}
						className="md:hidden border-white/10 bg-transparent text-white"
						aria-expanded={open}
						aria-controls="mobile-menu"
						aria-label="Toggle menu"
					>
						<MenuToggleIcon open={open} className="size-5" duration={300} />
					</Button>
				</nav>
				<MobileMenu open={open} className="flex flex-col justify-between gap-2">
					<div className="grid gap-y-2">
						{links.map((link) => (
							<a
								key={link.label}
								className={buttonVariants({
									variant: 'ghost',
									className: 'justify-start text-white/80 hover:text-white',
								})}
								href={link.href}
							>
								{link.label}
							</a>
						))}
					</div>
					<div className="flex flex-col gap-2">
						<Button variant="outline" className="w-full bg-transparent border-purple-500/30 text-purple-300 hover:bg-purple-600/20" onClick={() => { setOpen(false); setSetupOpen(true); }}>
							Setup Guide
						</Button>
						<a href="/" className={cn(buttonVariants({ variant: 'outline' }), "w-full bg-transparent border-white/10 text-slate-300")}>
							Classic View
						</a>
						{user ? (
							<>
								<div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5">
									<div className="flex items-center gap-3">
										<img 
											className="w-8 h-8 rounded-full" 
											src={profile?.avatar_url || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzFlMjkzYiIvPjxjaXJjbGUgY3g9Ijc1IiBjeT0iNzUiIHI9IjQwIiBmaWxsPSIjNDc1NTY5Ii8+PC9zdmc+"} 
											alt="avatar" 
										/>
										<div className="text-left">
											<div className="text-xs font-bold text-white">{profile?.channel_name || user.email?.split('@')[0]}</div>
											<div className="text-[10px] text-slate-400">{profile?.role || 'Creator'}</div>
										</div>
									</div>
									<Button onClick={() => { setOpen(false); handleLogout(); }} variant="ghost" className="text-red-400 hover:text-red-300">Logout</Button>
								</div>
							</>
						) : (
							<>
								<Button variant="outline" className="w-full bg-transparent border-white/15 text-white" onClick={() => { setOpen(false); setIsSignUp(false); setAuthError(null); setAuthOpen(true); }}>
									Sign In
								</Button>
								<Button className="w-full bg-white text-black" onClick={() => { setOpen(false); setIsSignUp(true); setAuthError(null); setAuthOpen(true); }}>
									Get Started
								</Button>
							</>
						)}
					</div>
				</MobileMenu>
			</header>

			{/* Setup Guide Modal */}
			{setupOpen && createPortal(
				<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
					<div className="absolute inset-0" onClick={() => setSetupOpen(false)}></div>
					<div className="relative w-full max-w-2xl bg-slate-950/95 border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl text-white flex flex-col gap-6 animate-in zoom-in-95 duration-200">
						<button onClick={() => setSetupOpen(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all active:scale-90">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
							</svg>
						</button>

						<div className="flex items-center gap-3">
							<span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full">Setup Guide</span>
							<h2 className="text-2xl font-extrabold tracking-tight">Add Clip commands to your Stream</h2>
						</div>
						
						<p className="text-slate-400 leading-relaxed text-sm md:text-base">Simply copy the command below and add it to your channel chat via Nightbot to let your moderators and viewers save timestamps instantly:</p>
						
						<div className="bg-black/60 border border-white/5 rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
							<code className="text-xs md:text-sm font-mono text-purple-300 break-all select-all flex-grow p-1">{nightbotCommand}</code>
							<button onClick={handleCopy} className={cn("px-6 py-3 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-lg flex-shrink-0", copied ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20" : "bg-purple-600 hover:bg-purple-500 shadow-purple-600/20")}>
								{copied ? 'Copied!' : 'Copy'}
							</button>
						</div>
					</div>
				</div>,
				document.body
			)}

			{/* Authentication Modal */}
			{authOpen && createPortal(
				<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
					<div className="absolute inset-0" onClick={() => setAuthOpen(false)}></div>
					<div className="relative w-full max-w-md bg-slate-950/95 border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl text-white flex flex-col gap-6 animate-in zoom-in-95 duration-200">
						<button onClick={() => setAuthOpen(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all active:scale-90">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
							</svg>
						</button>

						<div className="flex flex-col gap-1.5">
							<span className="text-xs font-bold uppercase tracking-wider text-purple-400">Creator Panel</span>
							<h2 className="text-2xl font-extrabold tracking-tight">
								{isSignUp ? 'Creator Sign Up' : 'Creator Login'}
							</h2>
						</div>

						{signUpSuccess ? (
							<div className="flex flex-col items-center justify-center py-6 text-center gap-3">
								<div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
									<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
									</svg>
								</div>
								<h3 className="text-lg font-bold text-white">Sign Up Successful!</h3>
								<p className="text-sm text-slate-400">Switching to login mode...</p>
							</div>
						) : (
							<form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
								{authError && (
									<div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed">
										{authError}
									</div>
								)}

								<div className="flex flex-col gap-1.5">
									<label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Email Address</label>
									<input 
										type="email" 
										required 
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										placeholder="creator@example.com" 
										className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-white" 
									/>
								</div>

								<div className="flex flex-col gap-1.5">
									<label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Password</label>
									<input 
										type="password" 
										required 
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										placeholder="••••••••" 
										className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-white" 
									/>
								</div>

								{isSignUp && (
									<div className="flex flex-col gap-1.5">
										<label className="text-xs font-bold text-slate-400 uppercase tracking-wide">YouTube Channel ID</label>
										<input 
											type="text" 
											required 
											value={channelId}
											onChange={(e) => setChannelId(e.target.value)}
											placeholder="UCxxxxxxxxxxxx" 
											className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-white" 
										/>
									</div>
								)}

								<Button 
									type="submit" 
									disabled={authLoading}
									className="w-full h-11 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-600/20 transition-all duration-200 mt-2 flex items-center justify-center gap-2"
								>
									{authLoading ? (
										<svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
											<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
											<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
									) : null}
									{isSignUp ? 'Sign Up' : 'Sign In'}
								</Button>

								<div className="text-center mt-2">
									<button 
										type="button"
										onClick={() => { setIsSignUp(!isSignUp); setAuthError(null); }}
										className="text-xs text-slate-400 hover:text-white transition-colors"
									>
										{isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
									</button>
								</div>
							</form>
						)}
					</div>
				</div>,
				document.body
			)}
		</>
	);
}

type MobileMenuProps = React.ComponentProps<'div'> & {
	open: boolean;
};

function MobileMenu({ open, children, className, ...props }: MobileMenuProps) {
	if (!open || typeof window === 'undefined') return null;

	return createPortal(
		<div
			id="mobile-menu"
			className={cn(
				'bg-background/95 supports-[backdrop-filter]:bg-background/50 backdrop-blur-lg',
				'fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden border-y md:hidden',
			)}
		>
			<div
				data-slot={open ? 'open' : 'closed'}
				className={cn(
					'data-[slot=open]:animate-in data-[slot=open]:zoom-in-97 ease-out',
					'size-full p-4',
					className,
				)}
				{...props}
			>
				{children}
			</div>
		</div>,
		document.body,
	);
}

export const WordmarkIcon = (props: React.ComponentProps<"svg">) => (
  <svg viewBox="0 0 84 24" fill="currentColor" {...props}>
    <path d="M45.035 23.984c-1.34-.062-2.566-.441-3.777-1.16-1.938-1.152-3.465-3.187-4.02-5.36-.199-.784-.238-1.128-.234-2.058 0-.691.008-.87.062-1.207.23-1.5.852-2.883 1.852-4.144.297-.371 1.023-1.09 1.41-1.387 1.399-1.082 2.84-1.68 4.406-1.816.536-.047 1.528-.02 2.047.054 1.227.184 2.227.543 3.106 1.121 1.277.84 2.5 2.184 3.367 3.7.098.168.172.308.172.312-.004 0-1.047.723-2.32 1.598l-2.711 1.867c-.61.422-2.91 2.008-2.993 2.062l-.074.047-1-1.574c-.55-.867-1.008-1.594-1.012-1.61-.007-.019.922-.648 2.188-1.476 1.215-.793 2.2-1.453 2.191-1.46-.02-.032-.508-.27-.691-.34a5 5 0 0 0-.465-.13c-.371-.09-1.105-.125-1.426-.07-1.285.219-2.336 1.3-2.777 2.852-.215.761-.242 1.636-.074 2.355.129.527.383 1.102.691 1.543.234.332.727.82 1.047 1.031.664.434 1.195.586 1.969.555.613-.023 1.027-.129 1.64-.426 1.184-.574 2.16-1.554 2.828-2.843.122-.235.208-.372.227-.368.082.032 3.77 1.938 3.79 1.961.034.032-.407.93-.696 1.414a12 12 0 0 1-1.051 1.477c-.36.422-1.102 1.14-1.492 1.445a9.9 9.9 0 0 1-3.23 1.684 9.2 9.2 0 0 1-2.95.351M74.441 23.996c-1.488-.043-2.8-.363-4.066-.992-1.687-.848-2.992-2.14-3.793-3.774-.605-1.234-.863-2.402-.863-3.894.004-1.149.176-2.156.527-3.11.14-.378.531-1.171.75-1.515 1.078-1.703 2.758-2.934 4.805-3.524.847-.242 1.465-.332 2.433-.351 1.032-.024 1.743.055 2.48.277l.31.09.007 2.48c.004 1.364 0 2.481-.008 2.481a1 1 0 0 1-.12-.055c-.688-.347-2.09-.488-2.962-.296-.754.167-1.296.453-1.785.945a3.7 3.7 0 0 0-1.043 2.11c-.047.382-.02 1.109.055 1.437a3.4 3.4 0 0 0 .941 1.738c.75.75 1.715 1.102 2.875 1.05.645-.03 1.118-.14 1.563-.366q1.721-.864 2.02-3.145c.035-.293.042-1.266.042-7.957V0H84l-.012 8.434c-.008 7.851-.011 8.457-.054 8.757-.196 1.274-.586 2.25-1.301 3.243-1.293 1.808-3.555 3.07-6.145 3.437-.664.098-1.43.14-2.047.125M9.848 23.574a14 14 0 0 1-1.137-.152c-2.352-.426-4.555-1.781-6.117-3.774-.27-.335-.75-1.05-.95-1.406-1.156-2.047-1.695-4.27-1.64-6.77.047-1.995.43-3.66 1.23-5.316.524-1.086 1.04-1.87 1.793-2.715C4.567 1.72 6.652.535 8.793.171 9.68.02 10.093 0 12.297 0h1.789v5.441l-.961.016c-2.36.04-3.441.215-4.441.719-.836.414-1.278.879-1.895 1.976-.219.399-.535 1.02-.535 1.063 0 .02 1.285.027 3.918.027h3.914v5.113h-3.914c-2.54 0-3.918.008-3.918.028 0 .05.254.597.441.953.344.656.649 1.086 1.051 1.48.668.657 1.356.985 2.445 1.16.645.106 1.274.145 2.61.16l1.285.016v5.442l-2.055-.004a120 120 0 0 1-2.183-.016M16.469 14.715c0-5.504.011-9.04.031-9.29a5.54 5.54 0 0 1 1.527-3.48c.778-.82 1.922-1.457 3.118-1.734C21.915.035 22.422 0 24.39 0h1.652v4.914h-1.426c-1.324 0-1.445.004-1.644.055-.739.191-1.059.699-1.106 1.754l-.015.355h4.191v4.914h-4.184v11.602h-5.39ZM27.023 14.727c0-5.223.012-9.04.028-9.278.129-1.98 1.234-3.68 3.012-4.62.87-.462 1.777-.716 2.851-.802A61 61 0 0 1 34.945 0h1.649v4.914h-1.426c-1.32 0-1.441.004-1.64.055-.739.191-1.063.699-1.106 1.754l-.02.355h4.192v4.914H32.41v11.602h-5.387ZM55.48 15.406V7.22h4.66v1.363c0 1.3.005 1.363.051 1.363.04 0 .075-.054.133-.203.38-.98.969-1.68 1.711-2.031.563-.266 1.422-.43 2.492-.48l.414-.02v4.914l-.414.035c-.738.063-1.597.195-2.058.313-.297.082-.688.28-.875.449-.324.289-.532.703-.625 1.254-.094.547-.098.879-.098 5.144v4.274h-5.39Zm0 0" />
  </svg>
);
