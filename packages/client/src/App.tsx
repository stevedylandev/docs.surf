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
		return new Date(dateString).toLocaleDateString("en-US", {
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
				<div className="title-bar-text">docs.surf - Internet Explorer 6</div>
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
					<div className="feed" style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "5px" }}>
						{documents.map((doc) => (
							<fieldset key={doc.uri} style={{ marginBottom: "16px" }}>
								<legend style={{ fontWeight: "bold" }}>
									{doc.viewUrl ? (
										<a
											href={doc.viewUrl}
											target="_blank"
											rel="noopener noreferrer"
											style={{ color: "inherit", textDecoration: "none" }}
										>
											{doc.title}
										</a>
									) : (
										doc.title
									)}
								</legend>
								<div style={{ padding: "8px" }}>
									{/* Publication info */}
									{doc.publication && (
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "8px",
												marginBottom: "8px",
												fontSize: "0.85em",
											}}
										>
											{doc.publication.iconUrl && (
												<img
													src={doc.publication.iconUrl}
													alt={doc.publication.name}
													style={{
														width: "16px",
														height: "16px",
														objectFit: "cover",
													}}
												/>
											)}
											<span style={{ fontWeight: "bold" }}>
												{doc.publication.name}
											</span>
										</div>
									)}

									{/* Cover image */}
									{doc.coverImageUrl && (
										<div style={{ marginBottom: "8px" }}>
											<img
												src={doc.coverImageUrl}
												alt={doc.title}
												style={{
													maxWidth: "100%",
													maxHeight: "200px",
													objectFit: "cover",
													border: "1px solid #888",
												}}
											/>
										</div>
									)}

									{/* Date */}
									<div
										style={{
											marginBottom: "8px",
											fontSize: "0.85em",
											color: "#666",
										}}
									>
										Published: {formatDate(doc.publishedAt)}
										{doc.updatedAt && doc.updatedAt !== doc.publishedAt && (
											<> | Updated: {formatDate(doc.updatedAt)}</>
										)}
									</div>

									{/* Description */}
									{getDescription(doc) && (
										<p style={{ marginBottom: "12px" }}>
											{truncateText(getDescription(doc))}
										</p>
									)}

									{/* Tags */}
									{doc.tags && doc.tags.length > 0 && (
										<div
											style={{
												display: "flex",
												flexWrap: "wrap",
												gap: "4px",
												marginBottom: "12px",
											}}
										>
											{doc.tags.map((tag) => (
												<span
													key={tag}
													style={{
														background: "#c0c0c0",
														padding: "2px 6px",
														fontSize: "0.75em",
														border: "1px solid #808080",
													}}
												>
													{tag}
												</span>
											))}
										</div>
									)}

									{/* Actions */}
									<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
										{doc.bskyPostRef && (
											<button
												onClick={() =>
													window.open(
														`https://bsky.app/profile/${doc.did}/post/${doc.bskyPostRef!.uri.split("/").pop()}`,
														"_blank"
													)
												}
											>
												View on Bluesky
											</button>
										)}
										{doc.viewUrl && (
											<button
												onClick={() =>
													window.open(doc.viewUrl || "", "_blank")
												}
											>
												Read More
											</button>
										)}
									</div>
								</div>
							</fieldset>
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
