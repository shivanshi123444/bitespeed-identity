import { Router } from "express";
import { identifyContact } from "../services/contactService";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({
        message: "Either email or phoneNumber must be provided",
      });
    }

    const result = await identifyContact(email, phoneNumber);

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;   // ⚠️ VERY IMPORTANT
