import { contains, containsAny, defineGraders, judge } from '@/src/graders'
import { authUIChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  user_button_component: authUIChecks.usesUserButton,
  client_directive: contains("'use client'"),
  menu_items: contains('UserButton.MenuItems'),
  custom_action: contains('UserButton.Action'),
  custom_link: contains('UserButton.Link'),
  label_prop: containsAny(['label="', "label='", 'label={']),
  label_icon_prop: contains('labelIcon'),
  onClick_handler: contains('onClick={'),
  href_prop: contains('href='),
  import_from_clerk: contains("from '@clerk/nextjs'"),
  custom_menu_structure: judge(
    'Does the solution demonstrate adding both a custom action (with onClick handler) and a custom link (with href) to the UserButton menu, each with a custom icon using labelIcon?',
  ),
})
