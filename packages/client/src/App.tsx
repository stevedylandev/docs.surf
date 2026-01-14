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
			const response = await fetch(`${API_URL}/feed`);
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
		<div className="window" style={{ width: "100%", maxWidth: "800px" }}>
			<div className="title-bar">
				<div className="title-bar-text">Internet Explorer 6</div>
				<div className="title-bar-controls">
					<button aria-label="Minimize" />
					<button aria-label="Maximize" />
					<button aria-label="Close" />
				</div>
			</div>
			<div className="window-body">
				<div
					style={{
						display: "flex",
						gap: "8px",
						marginBottom: "16px",
						alignItems: "center",
					}}
				>
					<button onClick={fetchFeed}>Refresh</button>
					<button
						onClick={() => window.open("https://standard.site", "_blank")}
					>
						Standard.site
					</button>
					<div style={{ flex: 1 }} />
					<span>{documents.length} documents</span>
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
