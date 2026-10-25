import * as WebBrowser from 'expo-web-browser';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { RowLink, Rule } from '@/components/ui';
import { SectionHead } from '@/components/ui/Serif';
import { space, useColors } from '@/theme';

// Every number and URL here is a verified row in docs/OFFICIAL_SOURCES.md section 1 (Oct 24 2026).
const HOTLINE = '18002525400';
const CCR_FORM = 'https://childcare.hhs.texas.gov/Public/makeAReport';
const HOTLINE_WEB = 'https://www.txabusehotline.org/Login/Default.aspx';
const PLANO_OFFICE = '4692296900,6901';

export default function ReportScreen() {
  const c = useColors();
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      <T variant="callout" tone="secondary">
        These are the State of Texas&rsquo;s own channels. This app doesn&rsquo;t receive or forward reports.
      </T>

      <View style={styles.section}>
        <SectionHead title="A child is in danger right now" first />
        <RowLink flush title="Call 911" detail="Emergencies and life-threatening situations" onPress={() => void Linking.openURL('tel:911')} />
      </View>

      <View style={styles.section}>
        <SectionHead title="Suspected abuse or neglect" />
        <View>
          <RowLink
            flush
            title="Texas Abuse Hotline"
            detail="1-800-252-5400 · 24 hours a day, 7 days a week"
            onPress={() => void Linking.openURL(`tel:${HOTLINE}`)}
          />
          <Rule />
          <RowLink
            flush
            title="Report online"
            detail="TxAbuseHotline.org · not for urgent situations"
            external
            onPress={() => void WebBrowser.openBrowserAsync(HOTLINE_WEB)}
          />
        </View>
        <T variant="footnote" tone="tertiary">
          The state does not accept anonymous abuse or neglect reports. Deaf or hard of hearing callers can use Relay
          Texas at 7-1-1.
        </T>
      </View>

      <View style={styles.section}>
        <SectionHead title="A daycare isn’t following the rules" />
        <View>
          <RowLink
            flush
            title="Child Care Regulation report form"
            detail="Texas Health and Human Services"
            external
            onPress={() => void WebBrowser.openBrowserAsync(CCR_FORM)}
          />
          <Rule />
          <RowLink
            flush
            title="Local Child Care Regulation office"
            detail="Plano · 469-229-6900 ext. 6901 · weekdays"
            onPress={() => void Linking.openURL(`tel:${PLANO_OFFICE}`)}
          />
        </View>
        <T variant="footnote" tone="tertiary">
          The online form asks for your name. To report anonymously, call your local Child Care Regulation office. The
          form is not for abuse or neglect; use the hotline above.
        </T>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md, paddingBottom: space.section },
  section: { gap: space.sm },
});
