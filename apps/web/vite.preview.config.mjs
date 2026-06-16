const previewAllowedHosts = process.env.PREVIEW_ALLOWED_HOSTS?.split(",")
	.map((host) => host.trim())
	.filter(Boolean);

export default {
	preview: {
		allowedHosts: previewAllowedHosts,
	},
};
