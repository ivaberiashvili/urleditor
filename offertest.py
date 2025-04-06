from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import traceback

# .env
from dotenv import load_dotenv
import os

load_dotenv() 

EMAIL = os.getenv("EMAIL")
PASSWORD = os.getenv("PASSWORD")


# Set up the browser
options = Options()
options.add_argument("--start-maximized")
driver = webdriver.Chrome(service=Service(), options=options)
driver.maximize_window()

try:
    # 1. Go to main page
    driver.get("https://console.mobadvcons.com/auth/login")

    # 2. Fill in login credentials
    wait = WebDriverWait(driver, 10)
    email_input = wait.until(EC.visibility_of_element_located((By.NAME, "email")))
    email_input.send_keys(EMAIL)

    password_input = driver.find_element(By.NAME, "password")
    password_input.send_keys(PASSWORD)

    # 3. Click login
    login_button = driver.find_element(By.XPATH, "//div[@class='v-btn__content' and normalize-space(text())='Login']")
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", login_button)
    login_button.click()

    time.sleep(2)  # Optional: wait for navigation

    # Click "Tracking" first to expand the submenu
    tracking = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//div[@class='v-list__tile__title' and normalize-space(text())='Tracking']"))
    )
    tracking.click()

    # Now wait for and click "Reports"
    reports = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//div[@class='v-list__tile__title' and normalize-space(text())='Reports']"))
    )
    reports.click()

    # 6. Click "Filters"
    filters = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//div[normalize-space(text())='Filters']"))
    )
    filters.click()

    time.sleep(1)  # Optional: wait for filter panel to expand

    # 7. Type "example" into input next to "Offer"
    offer_input = WebDriverWait(driver, 10).until(
        EC.visibility_of_element_located((By.XPATH, "//div[normalize-space(text())='Offer']/following::input[@placeholder='Type to search'][1]"))
    )

    # Scroll into view
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", offer_input)

    # Now type
    offer_input.send_keys("f0dfb63643e5e906")

    # 8. Click "Run"
    run_button = driver.find_element(By.XPATH, "//div[@class='v-btn__content' and normalize-space(text())='Run']")
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", run_button)
    run_button.click()

    # 9. Leave tab open for review
    print("✅ Test completed. Tab left open for review.")

except Exception as e:
    print("❌ Error:", str(e))
    traceback.print_exc()

# Do not close browser so you can see the result
# driver.quit()  # Leave commented out on purpose



