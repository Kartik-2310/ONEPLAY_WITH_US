router.get("/test", (req, res) => {
  res.json({
    success: true,
    route: "payment route working"
  });
});