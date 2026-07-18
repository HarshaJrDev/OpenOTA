import { Router } from "express";


const router = Router();

router.use("/health", healthRouter);
router.use("/api/packages", packageRouter);
router.use("/packages", packageRouter);

export default router;