#!/usr/bin/env python3
"""Geometry tests for crop-bands.py. Stdlib only, no PIL, so CI needs no image stack.

Run: python3 -m unittest discover -s banner -p "*_test.py"
"""
import importlib.util
import os
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('crop_bands', os.path.join(_HERE, 'crop-bands.py'))
crop_bands = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(crop_bands)

plan_crop = crop_bands.plan_crop
TARGET_W, TARGET_H = crop_bands.TARGET_W, crop_bands.TARGET_H
TARGET_AR = crop_bands.TARGET_AR


class PlanCrop(unittest.TestCase):
    def test_gpt_image_2_render_is_taken_whole(self):
        # 1915x821 is 21:9 within tolerance; band detection reports a spurious 37px top
        # band on it. Stripping that band is what used to clip the kicker.
        self.assertEqual(plan_crop(1915, 821, 37, 0), (0, 0, 1915, 821))

    def test_kicker_corner_is_never_cropped_away(self):
        # The amber kicker sits top-left, so left and upper must survive every path.
        cases = [
            (1915, 821, 37, 0),      # already target aspect
            (2048, 1152, 137, 137),  # true letterbox
            (2400, 900, 0, 0),       # too wide, no bands
            (2048, 1152, 0, 0),      # too tall, no bands
            (1915, 784, 0, 0),       # too wide, post-strip proportions
        ]
        for w, h, top, bot in cases:
            with self.subTest(raw=f'{w}x{h}', bands=(top, bot)):
                left, upper, right, lower = plan_crop(w, h, top, bot)
                self.assertEqual(left, 0, 'width was trimmed off the left, clipping the kicker')
                self.assertIn(upper, (0, top), 'crop started below the band boundary')
                self.assertGreater(right, left)
                self.assertGreater(lower, upper)

    def test_true_letterbox_strips_both_bands(self):
        # 2048x1152 with symmetric cream bands is the case the band strip exists for.
        self.assertEqual(plan_crop(2048, 1152, 137, 137), (0, 137, 2048, 1015))

    def test_overhang_is_trimmed_to_target_aspect(self):
        for w, h, top, bot in [(2400, 900, 0, 0), (2048, 1152, 0, 0), (3000, 1000, 20, 10)]:
            with self.subTest(raw=f'{w}x{h}'):
                left, upper, right, lower = plan_crop(w, h, top, bot)
                ar = (right - left) / (lower - upper)
                self.assertAlmostEqual(ar, TARGET_AR, places=2)

    def test_crop_box_stays_inside_the_source_frame(self):
        for w, h, top, bot in [(1915, 821, 37, 0), (2048, 1152, 137, 137), (2400, 900, 0, 0)]:
            with self.subTest(raw=f'{w}x{h}'):
                left, upper, right, lower = plan_crop(w, h, top, bot)
                self.assertGreaterEqual(left, 0)
                self.assertGreaterEqual(upper, 0)
                self.assertLessEqual(right, w)
                self.assertLessEqual(lower, h)

    def test_target_frame_is_the_canonical_banner_size(self):
        self.assertEqual((TARGET_W, TARGET_H), (2048, 878))


if __name__ == '__main__':
    unittest.main()
