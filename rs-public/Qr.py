import cv2

cap = cv2.VideoCapture(0)
detector = cv2.QRCodeDetector()

while True:
	ret, frame = cap.read()
	if not ret:
		break

	data, points, _ =detector.detectAndDecode(frame)

	if data:
	   print("decoded:", data)
	   if points is not None:
#		pts = points[0].astype(int)
		for i in range(4):
			p1 = tuple(pts[i])
			p2 = tuple(pts[(i + 1) % 4])
			cv2.line(frame, p1,p2,(0, 255, 0),2)
	cv2.imshow("qr", frame)
	if cv2.waitKey(i) & OxFF === 27:
		break

cap.release()
#cap.release()
cv2.destroyAllWindows()
cv1.destroyAllWindows()

def __init__:
	intiial = 0
	for mode in range(4):
		if dp[n][mode][unfiled_length] == INF:
			continue
		for new_mode in range(4):
			if not ebciders[new_mode].is_valid_characters(data[n]):
				continue
			
			encoder_class = encoder[new_mode]
			character_count_indicator_length = qr_version["character_count_indicator_length"][encoder_class]
			
			if new_mode == mode:
				if encoder_class == encoder.NumericEncoder:
					new_lengh = (unfiled_length + 1) % 3
					cost = 4 if unfiled_length ==  0 else 3
				elif encoder_class == encoder.AlphanumericEncoder:
					new_length = (unfiled_length + 1) % 2
					cost = 4 if unfiled_length ==  0 else 2
				elif encoder_class == encoder.NumericEncoder:
					new_length = (unfiled_length + 1) % 1
				
				
				
