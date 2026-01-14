import { useEffect, useState } from "react";

// API base URL - empty for same-origin (local dev), or set via env var for production
const API_URL = "https://atfeeds-api.stevedsimkins.workers.dev";

interface BskyPostRef {
	uri: string;
	cid: string;
}

interface Publication {
	url: string;
	name: string;
	description?: string;
	iconCid?: string;
	iconUrl?: string;
}

interface Document {
	uri: string;
	did: string;
	rkey: string;
	title: string;
	description?: string;
	path?: string;
	site?: string;
	content?: {
		$type: string;
		markdown?: string;
	};
	textContent?: string;
	coverImageCid?: string;
	coverImageUrl?: string;
	bskyPostRef?: BskyPostRef;
	tags?: string[];
	publishedAt?: string;
	updatedAt?: string;
	publication?: Publication;
	viewUrl?: string;
	pdsEndpoint?: string;
}

interface FeedResponse {
	count: number;
	limit: number;
	offset: number;
	documents: Document[];
}

function App() {
	const [documents, setDocuments] = useState<Document[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchFeed = async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch(`${API_URL}/feed?limit=100`);
			if (!response.ok) {
				throw new Error("Failed to fetch feed");
			}
			const data: FeedResponse = await response.json();
			setDocuments(data.documents);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchFeed();
	}, []);

	const formatDate = (dateString?: string) => {
		if (!dateString) return "Unknown date";
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return "just now";
		if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
		if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
		if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	const truncateText = (text?: string, maxLength: number = 200) => {
		if (!text) return "";
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength) + "...";
	};

	const getDescription = (doc: Document) => {
		return doc.description || doc.textContent || "";
	};

	return (
		<div className="window" style={{ width: "100%", maxWidth: "900px" }}>
			<div className="title-bar">
				<div className="title-bar-text">
					Docs.surf - Microsoft Internet Explorer
				</div>
				<div className="title-bar-controls">
					<button aria-label="Minimize" />
					<button aria-label="Maximize" />
					<button aria-label="Close" />
				</div>
			</div>

			{/* IE Chrome Container */}
			<div style={{ margin: "0 2px" }}>
				{/* Menu Bar */}
				<div
					style={{
						display: "flex",
						justifyContent: "flex-start",
						padding: "2px 0",
						backgroundColor: "#ece9d8",
						borderBottom: "1px solid #aca899",
						fontSize: "11px",
					}}
				>
					{["File", "Edit", "View", "Favorites", "Tools", "Help"].map(
						(item) => (
							<span
								key={item}
								style={{
									padding: "2px 8px",
									cursor: "pointer",
								}}
							>
								{item}
							</span>
						),
					)}
				</div>

				{/* Toolbar */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "0",
						padding: "3px 2px",
						backgroundColor: "#ece9d8",
						borderBottom: "1px solid #aca899",
					}}
				>
					{/* Back button */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "2px",
							padding: "0 6px",
							cursor: "pointer",
						}}
					>
						<img
							src="/windows-icons/Back.png"
							alt="Back"
							style={{ width: "22px", height: "22px" }}
						/>
						<span style={{ fontSize: "11px" }}>Back</span>
						<span style={{ fontSize: "8px", marginLeft: "2px" }}>▼</span>
					</div>

					{/* Forward button */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							padding: "0 4px",
							cursor: "pointer",
						}}
					>
						<img
							src="/windows-icons/Forward.png"
							alt="Forward"
							style={{ width: "22px", height: "22px" }}
						/>
					</div>

					<div
						style={{
							width: "1px",
							height: "22px",
							backgroundColor: "#aca899",
							margin: "0 4px",
						}}
					/>

					{/* Stop */}
					<div
						style={{
							padding: "0 4px",
							cursor: "pointer",
						}}
					>
						<img
							src="/windows-icons/Stop.png"
							alt="Stop"
							style={{ width: "22px", height: "22px" }}
						/>
					</div>

					{/* Refresh */}
					<div
						onClick={fetchFeed}
						style={{
							padding: "0 4px",
							cursor: "pointer",
						}}
					>
						<img
							src="/windows-icons/IE Refresh.png"
							alt="Refresh"
							style={{ width: "22px", height: "22px" }}
						/>
					</div>

					{/* Home */}
					<a
						href="https://stevedylan.dev"
						target="_blank"
						rel="noreferrer"
						style={{
							padding: "0 4px",
							cursor: "pointer",
						}}
					>
						<img
							src="/windows-icons/IE Home.png"
							alt="Home"
							style={{ width: "22px", height: "22px" }}
						/>
					</a>

					<div
						style={{
							width: "1px",
							height: "22px",
							backgroundColor: "#aca899",
							margin: "0 4px",
						}}
					/>

					{/* Search */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "3px",
							padding: "0 6px",
							cursor: "pointer",
						}}
					>
						<img
							src="/windows-icons/Search.png"
							alt="Search"
							style={{ width: "22px", height: "22px" }}
						/>
						<span style={{ fontSize: "11px" }}>Search</span>
					</div>

					{/* Favorites */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "3px",
							padding: "0 6px",
							cursor: "pointer",
						}}
					>
						<img
							src="/windows-icons/Favorites.png"
							alt="Favorites"
							style={{ width: "22px", height: "22px" }}
						/>
						<span style={{ fontSize: "11px" }}>Favorites</span>
					</div>

					<div
						style={{
							width: "1px",
							height: "22px",
							backgroundColor: "#aca899",
							margin: "0 4px",
						}}
					/>

					{/* Mail */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							padding: "0 4px",
							cursor: "pointer",
						}}
					>
						<img
							src="/windows-icons/Email.png"
							alt="Mail"
							style={{ width: "22px", height: "22px" }}
						/>
						<span style={{ fontSize: "8px", marginLeft: "1px" }}>▼</span>
					</div>

					{/* Print */}
					<div
						style={{
							padding: "0 4px",
							cursor: "pointer",
						}}
					>
						<img
							src="/windows-icons/Printer.png"
							alt="Print"
							style={{ width: "22px", height: "22px" }}
						/>
					</div>
				</div>

				{/* Address Bar */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "4px",
						padding: "2px 4px",
						backgroundColor: "#ece9d8",
						borderBottom: "1px solid #aca899",
					}}
				>
					<span style={{ fontSize: "11px" }}>Address</span>
					<div
						style={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							backgroundColor: "white",
							border: "1px solid #7f9db9",
							padding: "2px 4px",
						}}
					>
						<img
							src="/windows-icons/Internet Explorer 6.png"
							alt=""
							style={{ width: "16px", height: "16px", marginRight: "4px" }}
						/>
						<span style={{ flex: 1, fontSize: "12px", color: "#000" }}>
							https://docs.surf
						</span>
						<span
							style={{
								fontSize: "10px",
								color: "#666",
								padding: "0 4px",
								cursor: "pointer",
							}}
						>
							▼
						</span>
					</div>
					<button
						style={{
							display: "flex",
							alignItems: "center",
							gap: "3px",
							padding: "2px 12px",
							fontSize: "11px",
							minWidth: "50px",
						}}
					>
						<img
							src="/windows-icons/Go.png"
							alt=""
							style={{ width: "16px", height: "16px" }}
						/>
						Go
					</button>
					<span style={{ fontSize: "11px", marginLeft: "4px" }}>Links</span>
					<span style={{ fontSize: "10px" }}>»</span>
				</div>
			</div>

			<div className="window-body" style={{ margin: 0, padding: "4px 6px" }}>
				<div
					style={{
						display: "flex",
						gap: "4px",
						marginBottom: "4px",
						alignItems: "center",
						fontSize: "11px",
					}}
				>
					<span>{documents.length} documents loaded</span>
				</div>

				{loading && <p style={{ textAlign: "center" }}>Searching...</p>}

				{error && (
					<div
						style={{
							padding: "10px",
							background: "#ffefef",
							border: "1px solid #ff0000",
						}}
					>
						<p>Error: {error}</p>
					</div>
				)}

				{!loading && !error && (
					<div
						className="feed"
						style={{
							maxHeight: "70vh",
							overflowY: "auto",
							paddingRight: "5px",
						}}
					>
						{documents.map((doc, index) => (
							<div
								key={doc.uri}
								style={{
									display: "flex",
									gap: "12px",
									padding: "16px",
									borderBottom:
										index < documents.length - 1 ? "1px solid #e0e0e0" : "none",
									backgroundColor: "#ffffff",
									position: "relative",
								}}
							>
								{/* Thumbnail on the left */}
								<div style={{ flexShrink: 0 }}>
									{doc.coverImageUrl || doc.publication?.iconUrl ? (
										<img
											src={doc.coverImageUrl || doc.publication?.iconUrl}
											alt={doc.title}
											style={{
												width: "88px",
												height: "88px",
												objectFit: "scale-down",
												border: "1px solid #d0d0d0",
											}}
										/>
									) : (
										<div
											style={{
												width: "88px",
												height: "88px",
												backgroundColor: "#f0f0f0",
												border: "1px solid #d0d0d0",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												fontSize: "10px",
												color: "#999",
											}}
										>
											No Image
										</div>
									)}
								</div>

								{/* Content on the right */}
								<div style={{ flex: 1, minWidth: 0 }}>
									{/* Title */}
									<h3
										style={{
											margin: "0 0 8px 0",
											fontSize: "15px",
											fontWeight: "normal",
											color: "#333",
											lineHeight: "1.3",
										}}
									>
										{doc.viewUrl ? (
											<a
												href={doc.viewUrl}
												target="_blank"
												rel="noopener noreferrer"
												style={{
													color: "#333",
													textDecoration: "none",
												}}
											>
												{doc.title}
											</a>
										) : (
											doc.title
										)}
									</h3>

									{/* Description */}
									{getDescription(doc) && (
										<p
											style={{
												margin: "0 0 8px 0",
												fontSize: "12px",
												color: "#666",
												lineHeight: "1.4",
											}}
										>
											{truncateText(getDescription(doc), 150)}
										</p>
									)}

									{/* Publication name and timestamp */}
									<div
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											fontSize: "12px",
										}}
									>
										<a
											href={doc.publication?.url}
											target="_blank"
											rel="noreferrer"
											style={{
												color: "#7aaa3c",
												fontWeight: "bold",
											}}
										>
											{doc.publication?.name || "Unknown"}
										</a>
										<a
											href={`https://pdsls.dev/${doc.uri}`}
											target="_blank"
											rel="noreferrer"
											style={{
												color: "#999",
											}}
										>
											{formatDate(doc.publishedAt)}
										</a>
									</div>
								</div>

								{/* RSS icon on the far right */}
								{/*<div style={{ flexShrink: 0 }}>
									<svg
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
										style={{ opacity: 0.6 }}
									>
										<circle cx="6" cy="18" r="2" fill="#ff6600" />
										<path
											d="M4 4c9.941 0 18 8.059 18 18"
											stroke="#ff6600"
											strokeWidth="2"
											fill="none"
										/>
										<path
											d="M4 11c6.075 0 11 4.925 11 11"
											stroke="#ff6600"
											strokeWidth="2"
											fill="none"
										/>
									</svg>
								</div>*/}
							</div>
						))}
						{documents.length === 0 && <p>No documents found.</p>}
					</div>
				)}
			</div>
			<div className="status-bar">
				<p className="status-bar-field">Done</p>
				<p className="status-bar-field">Internet</p>
			</div>
		</div>
	);
}

export default App;
